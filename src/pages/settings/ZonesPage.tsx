import { useState, useEffect, useCallback, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { supabase } from "../../lib/supabase";
import {
  Plus,
  Edit2,
  Trash2,
  Download,
  MapPin,
  Search,
  Navigation,
  LocateFixed,
} from "lucide-react";
import { Spinner, Modal } from "../../components/ui";
import type { Zone } from "../../types";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const EMPTY_FORM = {
  office_name: "",
  office_address: "",
  latitude: "",
  longitude: "",
  radius_meters: "200",
};

// ── Sub-components ──────────────────────────────────────────

function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function FlyToLocation({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prev = useRef("");
  useEffect(() => {
    const key = `${lat},${lng}`;
    if (key !== prev.current && !isNaN(lat) && !isNaN(lng)) {
      map.flyTo([lat, lng], 16, { duration: 1 });
      prev.current = key;
    }
  }, [lat, lng, map]);
  return null;
}

function DraggableMarker({
  lat,
  lng,
  radius,
  onDrag,
}: {
  lat: number;
  lng: number;
  radius: number;
  onDrag: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);
  return (
    <>
      <Circle
        center={[lat, lng]}
        radius={radius}
        pathOptions={{
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.15,
          weight: 2,
        }}
      />
      <Marker
        ref={markerRef}
        position={[lat, lng]}
        draggable
        eventHandlers={{
          dragend() {
            const m = markerRef.current;
            if (m) {
              const p = m.getLatLng();
              onDrag(p.lat, p.lng);
            }
          },
        }}
      />
    </>
  );
}

// ── Main ────────────────────────────────────────────────────

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [, setTodayCount] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Zone | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Zone | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState("");

  // Address geocoding search
  const [addrSearch, setAddrSearch] = useState("");
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrError, setAddrError] = useState("");

  const fetchZones = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("zones")
      .select("*")
      .order("office_name");
    setZones((data || []) as Zone[]);
    setLoading(false);
  }, []);

  // Count employees checked in today per zone
  const fetchTodayCount = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("attendances")
      .select("employee_id, location_in_status")
      .eq("attendance_date", today);
    if (!data) return;
    // const map: Record<string, number> = {}
    // we count per zone by cross-checking coordinates proximity (approximate)
    // simpler: count all present employees
    const total = data.filter(
      (r) => r.location_in_status !== "out_of_area",
    ).length;
    setTodayCount({ _total: total });
  }, []);

  useEffect(() => {
    fetchZones();
    fetchTodayCount();
  }, [fetchZones, fetchTodayCount]);

  const setField = (key: string, val: string) =>
    setForm((p) => ({ ...p, [key]: val }));

  const openAdd = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setAddrSearch("");
    setAddrError("");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (z: Zone) => {
    setEditTarget(z);
    setForm({
      office_name: z.office_name,
      office_address: z.office_address || "",
      latitude: String(z.latitude),
      longitude: String(z.longitude),
      radius_meters: String(z.radius_meters),
    });
    setAddrSearch("");
    setAddrError("");
    setFormError("");
    setModalOpen(true);
  };

  // Nominatim geocoding
  const handleAddrSearch = async () => {
    if (!addrSearch.trim()) return;
    setAddrLoading(true);
    setAddrError("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addrSearch)}&format=json&limit=1`,
        { headers: { "Accept-Language": "id" } },
      );
      const data = await res.json();
      if (data.length === 0) {
        setAddrError("Lokasi tidak ditemukan");
        return;
      }
      const { lat, lon, display_name } = data[0];
      setField("latitude", parseFloat(lat).toFixed(6));
      setField("longitude", parseFloat(lon).toFixed(6));
      if (!form.office_address)
        setField(
          "office_address",
          display_name.split(",").slice(0, 3).join(","),
        );
    } catch {
      setAddrError("Gagal mencari lokasi");
    } finally {
      setAddrLoading(false);
    }
  };

  // Get current GPS location
  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setField("latitude", pos.coords.latitude.toFixed(6));
      setField("longitude", pos.coords.longitude.toFixed(6));
    });
  };

  const handleSave = async () => {
    if (!form.office_name.trim()) {
      setFormError("Nama kantor wajib diisi");
      return;
    }
    if (!form.latitude || !form.longitude) {
      setFormError("Pilih lokasi pada peta atau cari alamat");
      return;
    }
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      setFormError("Koordinat tidak valid");
      return;
    }
    setFormError("");
    setSaving(true);
    const payload = {
      office_name: form.office_name,
      office_address: form.office_address || null,
      latitude: lat,
      longitude: lng,
      radius_meters: parseInt(form.radius_meters) || 200,
      updated_at: new Date().toISOString(),
    };
    try {
      if (editTarget) {
        const { error } = await supabase
          .from("zones")
          .update(payload)
          .eq("id", editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("zones").insert(payload);
        if (error) throw error;
      }
      setModalOpen(false);
      fetchZones();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("zones").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    fetchZones();
  };

  const mainCenter: [number, number] =
    zones.length > 0
      ? [zones[0].latitude, zones[0].longitude]
      : [-8.1726, 113.688];

  const modalLat = parseFloat(form.latitude);
  const modalLng = parseFloat(form.longitude);
  const hasCoords = !isNaN(modalLat) && !isNaN(modalLng);
  const modalCenter: [number, number] = hasCoords
    ? [modalLat, modalLng]
    : [-8.1726, 113.688];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Zones</h1>
        <div className="flex gap-2">
          <button className="btn-secondary">
            <Download size={14} /> Download Report
          </button>
          <button onClick={openAdd} className="btn-primary">
            <Plus size={14} /> Add Zone
          </button>
        </div>
      </div>

      {/* ── Main map ── */}
      <div className="card mb-4 overflow-hidden">
        <div className="h-80">
          {loading ? (
            <div className="h-full flex items-center justify-center bg-gray-50">
              <Spinner />
            </div>
          ) : (
            <MapContainer
              center={mainCenter}
              zoom={zones.length > 0 ? 15 : 13}
              className="w-full h-full"
              style={{ zIndex: 0 }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {zones.map((zone) => (
                <Circle
                  key={zone.id}
                  center={[zone.latitude, zone.longitude]}
                  radius={zone.radius_meters}
                  pathOptions={{
                    color: "#3b82f6",
                    fillColor: "#3b82f6",
                    fillOpacity: 0.12,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="text-xs min-w-[180px]">
                      <p className="font-semibold text-sm">
                        {zone.office_name}
                      </p>
                      {zone.office_address && (
                        <p className="text-gray-500 mt-0.5 text-xs">
                          {zone.office_address}
                        </p>
                      )}
                      <div className="mt-1.5 space-y-0.5 font-mono text-gray-600 text-[11px]">
                        <p>Lat: {zone.latitude.toFixed(6)}</p>
                        <p>Lng: {zone.longitude.toFixed(6)}</p>
                        <p className="text-blue-600">
                          Radius: {zone.radius_meters}m
                        </p>
                      </div>
                      <button
                        onClick={() => openEdit(zone)}
                        className="mt-2 text-xs text-blue-600 hover:underline"
                      >
                        Edit zona ini
                      </button>
                    </div>
                  </Popup>
                </Circle>
              ))}
              {zones.map((zone) => (
                <Marker
                  key={`m-${zone.id}`}
                  position={[zone.latitude, zone.longitude]}
                >
                  <Popup>
                    <p className="font-semibold text-sm">{zone.office_name}</p>
                    <p className="text-xs text-blue-600">
                      Radius: {zone.radius_meters}m
                    </p>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Office Name</th>
                <th>Office Address</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Radius (m)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Spinner className="mx-auto" />
                  </td>
                </tr>
              ) : zones.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-16 text-gray-400 text-sm"
                  >
                    Belum ada zona
                  </td>
                </tr>
              ) : (
                zones.map((zone) => (
                  <tr key={zone.id} className="hover:bg-gray-50/60">
                    <td>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-blue-500 shrink-0" />
                        <span className="font-medium text-blue-600">
                          {zone.office_name}
                        </span>
                      </div>
                    </td>
                    <td className="text-gray-600 max-w-xs truncate">
                      {zone.office_address || "-"}
                    </td>
                    <td className="font-mono text-xs text-gray-600">
                      {zone.latitude.toFixed(6)}
                    </td>
                    <td className="font-mono text-xs text-gray-600">
                      {zone.longitude.toFixed(6)}
                    </td>
                    <td className="text-gray-700">{zone.radius_meters}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(zone)}
                          className="btn-icon text-blue-500"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(zone)}
                          className="btn-icon text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add/Edit Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Edit Zone" : "Add Zone"}
        width="max-w-lg"
      >
        <div className="space-y-3">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {formError}
            </div>
          )}

          {/* Address search */}
          <div>
            <label className="form-label">Cari Alamat / Nama Tempat</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  className="form-input pl-8"
                  placeholder="Contoh: SMKN 1 Jember..."
                  value={addrSearch}
                  onChange={(e) => setAddrSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddrSearch()}
                />
              </div>
              <button
                onClick={handleAddrSearch}
                disabled={addrLoading}
                className="btn-secondary shrink-0 px-3"
              >
                {addrLoading ? (
                  <Spinner className="w-4 h-4" />
                ) : (
                  <Navigation size={14} />
                )}
              </button>
              <button
                onClick={handleMyLocation}
                className="btn-secondary shrink-0 px-3"
                title="Gunakan lokasi saya"
              >
                <LocateFixed size={14} />
              </button>
            </div>
            {addrError && (
              <p className="text-xs text-red-500 mt-1">{addrError}</p>
            )}
            <p className="text-[11px] text-gray-400 mt-1">
              Atau klik langsung pada peta untuk menentukan lokasi
            </p>
          </div>

          {/* Interactive map */}
          <div>
            <label className="form-label">Lokasi di Peta</label>
            <div className="h-52 rounded-xl overflow-hidden border border-gray-200">
              <MapContainer
                center={modalCenter}
                zoom={15}
                className="w-full h-full"
                style={{ zIndex: 0 }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler
                  onPick={(lat, lng) => {
                    setField("latitude", lat.toFixed(6));
                    setField("longitude", lng.toFixed(6));
                  }}
                />
                {hasCoords && <FlyToLocation lat={modalLat} lng={modalLng} />}
                {hasCoords && (
                  <DraggableMarker
                    lat={modalLat}
                    lng={modalLng}
                    radius={parseInt(form.radius_meters) || 200}
                    onDrag={(lat, lng) => {
                      setField("latitude", lat.toFixed(6));
                      setField("longitude", lng.toFixed(6));
                    }}
                  />
                )}
              </MapContainer>
            </div>
            {hasCoords && (
              <p className="text-[11px] text-blue-600 font-mono mt-1">
                📍 {form.latitude}, {form.longitude}
                <span className="text-gray-400 ml-2">
                  (seret marker untuk menyesuaikan)
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="form-label">Office Name *</label>
            <input
              className="form-input"
              value={form.office_name}
              onChange={(e) => setField("office_name", e.target.value)}
              placeholder="Kantor Pusat"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Latitude *</label>
              <input
                className="form-input font-mono"
                value={form.latitude}
                onChange={(e) => setField("latitude", e.target.value)}
                placeholder="-8.200565"
              />
            </div>
            <div>
              <label className="form-label">Longitude *</label>
              <input
                className="form-input font-mono"
                value={form.longitude}
                onChange={(e) => setField("longitude", e.target.value)}
                placeholder="113.679296"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Office Address</label>
            <input
              className="form-input"
              value={form.office_address}
              onChange={(e) => setField("office_address", e.target.value)}
              placeholder="Jl. ..."
            />
          </div>

          <div>
            <label className="form-label">Radius Check-in (meter) *</label>
            <input
              className="form-input"
              type="number"
              min={50}
              value={form.radius_meters}
              onChange={(e) => setField("radius_meters", e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Lingkaran biru pada peta menunjukkan radius{" "}
              {form.radius_meters || 200}m
            </p>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5 pt-4 border-t border-gray-100">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? <Spinner className="w-4 h-4" /> : null} Simpan
          </button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Zone"
        width="max-w-sm"
      >
        <p className="text-sm text-gray-600 mb-5">
          Yakin ingin menghapus zona{" "}
          <strong>{deleteTarget?.office_name}</strong>?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setDeleteTarget(null)}
            className="btn-secondary"
          >
            Batal
          </button>
          <button onClick={handleDelete} className="btn-danger">
            Hapus
          </button>
        </div>
      </Modal>
    </div>
  );
}
