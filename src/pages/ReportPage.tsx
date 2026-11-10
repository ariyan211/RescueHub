import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crosshair,
  ImagePlus,
  X,
  Info,
  Loader2,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Badge } from "../components/ui/Badge";
import { useIncidents } from "../hooks/useIncidents";
import {
  CATEGORIES,
  SAFETY_ANSWERS,
  type NewIncidentInput,
  type SafetyAnswer,
} from "../types/incident";
import { compressImage, MAX_PHOTOS } from "../utils/image";
import { suggestSeverity } from "../utils/severity";

type FormState = {
  title: string;
  description: string;
  category: string;
  locationText: string;
  peopleAffected: string;
  contactName: string;
  contactDetails: string;
  immediateThreat: SafetyAnswer;
  peopleTrapped: SafetyAnswer;
  ongoingHazard: SafetyAnswer;
  coordinates?: { latitude: number; longitude: number };
};

const initial: FormState = {
  title: "",
  description: "",
  category: "",
  locationText: "",
  peopleAffected: "",
  contactName: "",
  contactDetails: "",
  immediateThreat: "Unknown",
  peopleTrapped: "Unknown",
  ongoingHazard: "Unknown",
};

function SafetyField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: SafetyAnswer;
  onChange: (value: SafetyAnswer) => void;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        {SAFETY_ANSWERS.map((answer) => (
          <label
            key={answer}
            className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition ${value === answer ? "border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
          >
            <input
              className="sr-only"
              type="radio"
              name={name}
              value={answer}
              checked={value === answer}
              onChange={() => onChange(answer)}
            />
            {answer}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function ReportPage() {
  const { submitIncident, storageError } = useIncidents();
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [saving, setSaving] = useState(false);
  const [reference, setReference] = useState("");
  const [locationState, setLocationState] = useState<"idle" | "loading" | "error">("idle");
  const suggestion = useMemo(
    () => suggestSeverity(form),
    [form.immediateThreat, form.peopleTrapped, form.ongoingHazard],
  );
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function validate() {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = "Enter a short incident title.";
    if (!form.description.trim()) next.description = "Describe what is happening.";
    if (!form.category) next.category = "Select an incident category.";
    if (!form.locationText.trim()) next.locationText = "Enter an address or recognizable location.";
    if (form.peopleAffected === "") next.peopleAffected = "Enter the number of people affected.";
    else if (!/^\d+$/.test(form.peopleAffected))
      next.peopleAffected = "Use a nonnegative whole number.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleReview(event: FormEvent) {
    event.preventDefault();
    if (validate()) {
      setStep("review");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    }
  }

  function useLocation() {
    if (!navigator.geolocation) {
      setLocationState("error");
      return;
    }
    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        set("coordinates", { latitude: coords.latitude, longitude: coords.longitude });
        setLocationState("idle");
      },
      () => setLocationState("error"),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setPhotoError("");
    const room = MAX_PHOTOS - photos.length;
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) setPhotoError(`Only ${MAX_PHOTOS} photos can be attached.`);
    try {
      const added = await Promise.all(chosen.map(compressImage));
      setPhotos((current) => [...current, ...added].slice(0, MAX_PHOTOS));
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Photo could not be added.");
    }
  }

  function submit() {
    if (saving) return;
    setSaving(true);
    try {
      const input: NewIncidentInput = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category as NewIncidentInput["category"],
        locationText: form.locationText.trim(),
        peopleAffected: Number(form.peopleAffected),
        immediateThreat: form.immediateThreat,
        peopleTrapped: form.peopleTrapped,
        ongoingHazard: form.ongoingHazard,
        ...(form.coordinates && { coordinates: form.coordinates }),
        ...(photos.length && { photos }),
        ...(form.contactName.trim() && { contactName: form.contactName.trim() }),
        ...(form.contactDetails.trim() && { contactDetails: form.contactDetails.trim() }),
      };
      const incident = submitIncident(input);
      setReference(incident.reference);
      setStep("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  if (step === "done")
    return (
      <main className="page-container py-14">
        <section className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-white p-7 text-center shadow-sm sm:p-10">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={28} />
          </span>
          <p className="eyebrow mt-5">Report saved</p>
          <h1 className="mt-2 text-3xl font-extrabold text-slate-950">
            Your incident report is ready for review.
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-slate-600">
            Keep this reference number to track the report in this browser demo.
          </p>
          {storageError && (
            <p role="alert" className="notice mx-auto mt-4 max-w-lg text-left">
              Browser storage is full, so this report (especially its photos) could not be saved and
              will be lost on reload. Delete reports or reset demo data, then try again.
            </p>
          )}
          <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-slate-950 p-5 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Incident reference
            </p>
            <p className="mt-2 text-2xl font-extrabold tracking-wide">{reference}</p>
          </div>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to={`/track?reference=${encodeURIComponent(reference)}`}
              className="button-primary justify-center"
            >
              Track this report
            </Link>
            <Link to="/" className="button-secondary justify-center">
              Return home
            </Link>
          </div>
        </section>
      </main>
    );

  if (step === "review")
    return (
      <main className="page-container py-12">
        <div className="mx-auto max-w-3xl">
          <button
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-700"
            onClick={() => setStep("form")}
          >
            <ArrowLeft size={16} />
            Edit report
          </button>
          <div className="section-heading">
            <span className="eyebrow">Final review</span>
            <h1>Check your report before submitting</h1>
            <p>All reports await administrator review, regardless of suggested severity.</p>
          </div>
          <section className="card mt-8">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 sm:flex-row">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {form.category}
                </p>
                <h2 className="mt-1 text-2xl font-bold">{form.title}</h2>
              </div>
              <Badge value={suggestion.severity} />
            </div>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt>Description</dt>
                <dd>{form.description}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{form.locationText}</dd>
              </div>
              <div>
                <dt>People affected</dt>
                <dd>{form.peopleAffected}</dd>
              </div>
              {photos.length > 0 && (
                <div className="sm:col-span-2">
                  <dt>Photos ({photos.length})</dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    {photos.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`Attached photo ${i + 1}`}
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                    ))}
                  </dd>
                </div>
              )}
              {form.coordinates && (
                <div className="sm:col-span-2">
                  <dt>Coordinates</dt>
                  <dd>
                    {form.coordinates.latitude.toFixed(5)}, {form.coordinates.longitude.toFixed(5)}
                  </dd>
                </div>
              )}
              <div>
                <dt>Immediate threat</dt>
                <dd>{form.immediateThreat}</dd>
              </div>
              <div>
                <dt>Anyone trapped</dt>
                <dd>{form.peopleTrapped}</dd>
              </div>
              <div>
                <dt>Ongoing hazard</dt>
                <dd>{form.ongoingHazard}</dd>
              </div>
              {(form.contactName || form.contactDetails) && (
                <div>
                  <dt>Optional contact</dt>
                  <dd>{[form.contactName, form.contactDetails].filter(Boolean).join(" · ")}</dd>
                </div>
              )}
            </dl>
          </section>
          <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 shrink-0 text-blue-700" size={20} />
              <div>
                <h2 className="font-bold text-blue-950">
                  {suggestion.severity} severity suggested
                </h2>
                <p className="mt-1 text-sm leading-6 text-blue-900">{suggestion.reason}</p>
                <p className="mt-3 text-xs font-bold text-blue-800">
                  Prototype severity suggestion, not validated emergency triage. Administrator
                  review required.
                </p>
              </div>
            </div>
          </section>
          <div className="mt-7 flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <button className="button-secondary justify-center" onClick={() => setStep("form")}>
              Edit report
            </button>
            <button className="button-primary justify-center" disabled={saving} onClick={submit}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" size={17} />
                  Saving…
                </>
              ) : (
                <>
                  Submit incident <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    );

  return (
    <main className="page-container py-12">
      <div className="mx-auto max-w-3xl">
        <div className="section-heading">
          <span className="eyebrow">Incident reporting</span>
          <h1>Report an incident</h1>
          <p>Provide clear, factual information. You can review everything before it is saved.</p>
        </div>
        <div className="notice mt-7">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>
            This prototype does not contact emergency services. If anyone is in immediate danger,
            contact your local emergency services now.
          </p>
        </div>
        <form onSubmit={handleReview} noValidate className="mt-8 space-y-6">
          <section className="form-section">
            <div className="form-section-title">
              <span>1</span>
              <div>
                <h2>Incident details</h2>
                <p>Tell administrators what is happening.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-5">
              <div>
                <label className="label" htmlFor="title">
                  Incident title <span aria-hidden="true">*</span>
                </label>
                <input
                  id="title"
                  className="input"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? "title-error" : undefined}
                />
                {errors.title && (
                  <p className="error" id="title-error">
                    {errors.title}
                  </p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="description">
                  Description <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id="description"
                  className="input min-h-32 resize-y"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  aria-invalid={!!errors.description}
                  aria-describedby={errors.description ? "description-error" : undefined}
                />
                {errors.description && (
                  <p className="error" id="description-error">
                    {errors.description}
                  </p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="category">
                  Category <span aria-hidden="true">*</span>
                </label>
                <select
                  id="category"
                  className="input"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  aria-invalid={!!errors.category}
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
                {errors.category && <p className="error">{errors.category}</p>}
              </div>
            </div>
          </section>
          <section className="form-section">
            <div className="form-section-title">
              <span>2</span>
              <div>
                <h2>Location and impact</h2>
                <p>Share where it is and the immediate safety picture.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-5">
              <div>
                <label className="label" htmlFor="photos">
                  Photos (optional)
                </label>
                <p className="mb-2 text-xs text-slate-500">
                  Up to {MAX_PHOTOS} images. Photos are resized and saved only in this browser. Do
                  not upload images of identifiable people.
                </p>
                <input
                  id="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={photos.length >= MAX_PHOTOS}
                  onChange={(e) => {
                    void addPhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
                <label
                  htmlFor="photos"
                  className={`button-secondary !py-2 ${photos.length >= MAX_PHOTOS ? "pointer-events-none opacity-50" : "cursor-pointer"} focus-within:ring-2`}
                >
                  <ImagePlus size={16} />
                  Add photos
                </label>
                {photoError && (
                  <p className="error" role="alert">
                    {photoError}
                  </p>
                )}
                {photos.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-3">
                    {photos.map((src, i) => (
                      <li key={i} className="relative">
                        <img
                          src={src}
                          alt={`Attached photo ${i + 1}`}
                          className="h-24 w-24 rounded-xl object-cover ring-1 ring-slate-200"
                        />
                        <button
                          type="button"
                          aria-label={`Remove photo ${i + 1}`}
                          className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-white"
                          onClick={() => setPhotos((c) => c.filter((_, n) => n !== i))}
                        >
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className="label" htmlFor="location">
                  Location or address <span aria-hidden="true">*</span>
                </label>
                <input
                  id="location"
                  className="input"
                  placeholder="Street address, landmark, or recognizable place"
                  value={form.locationText}
                  onChange={(e) => set("locationText", e.target.value)}
                  aria-invalid={!!errors.locationText}
                />
                {errors.locationText && <p className="error">{errors.locationText}</p>}
                <div className="mt-3">
                  <button
                    type="button"
                    className="button-secondary !px-3 !py-2"
                    onClick={useLocation}
                    disabled={locationState === "loading"}
                  >
                    {locationState === "loading" ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Crosshair size={16} />
                    )}
                    Use my location
                  </button>
                  {form.coordinates && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700">
                      <MapPin size={15} />
                      Coordinates captured: {form.coordinates.latitude.toFixed(5)},{" "}
                      {form.coordinates.longitude.toFixed(5)}. Manual address remains unchanged.
                    </p>
                  )}
                  {locationState === "error" && (
                    <p className="error">
                      Location could not be accessed. You can continue using the manual location
                      field.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="label" htmlFor="people">
                  People affected <span aria-hidden="true">*</span>
                </label>
                <input
                  id="people"
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={form.peopleAffected}
                  onChange={(e) => set("peopleAffected", e.target.value)}
                  aria-invalid={!!errors.peopleAffected}
                />
                {errors.peopleAffected && <p className="error">{errors.peopleAffected}</p>}
              </div>
              <div className="grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <SafetyField
                  name="immediateThreat"
                  label="Immediate threat to life?"
                  value={form.immediateThreat}
                  onChange={(value) => set("immediateThreat", value)}
                />
                <SafetyField
                  name="peopleTrapped"
                  label="Anyone trapped?"
                  value={form.peopleTrapped}
                  onChange={(value) => set("peopleTrapped", value)}
                />
                <SafetyField
                  name="ongoingHazard"
                  label="Hazard ongoing or spreading?"
                  value={form.ongoingHazard}
                  onChange={(value) => set("ongoingHazard", value)}
                />
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 shrink-0 text-blue-600" size={17} />
                  <div>
                    <strong>{suggestion.severity} suggested.</strong> {suggestion.reason}
                    <p className="mt-1 text-xs text-slate-500">
                      Prototype severity suggestion, not validated emergency triage. Administrator
                      review required.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="form-section">
            <div className="form-section-title">
              <span>3</span>
              <div>
                <h2>Optional contact information</h2>
                <p>Visible only to administrators in this demo.</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              Use fictional information in this demo.
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="contactName">
                  Contact name
                </label>
                <input
                  id="contactName"
                  className="input"
                  value={form.contactName}
                  onChange={(e) => set("contactName", e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="contactDetails">
                  Contact phone or email
                </label>
                <input
                  id="contactDetails"
                  className="input"
                  value={form.contactDetails}
                  onChange={(e) => set("contactDetails", e.target.value)}
                />
              </div>
            </div>
          </section>
          <div className="flex justify-end">
            <button className="button-primary w-full justify-center sm:w-auto" type="submit">
              Review report <ArrowRight size={17} />
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
