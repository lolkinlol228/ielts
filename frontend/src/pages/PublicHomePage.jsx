import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, MapPin, MessageCircle, Phone, Languages, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const LANGS = [
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
  { code: "kk", label: "KK" },
];

const STATIC_TEXT = {
  ru: {
    menuAbout: "О нас",
    menuTeachers: "Наши преподаватели",
    menuSuccess: "Успехи",
    menuReviews: "Отзывы",
    menuLocations: "Филиалы",
    login: "Войти",
    schedule: "Расписание занятий",
    whyChoose: "Почему выбирают нас",
    teachersTitle: "Наши преподаватели",
    teachersSubtitle: "Сильная команда преподавателей с фокусом на результат IELTS.",
    alumni: "Успехи выпускников",
    socialTalk: "Что о нас говорят в соц.сетях?",
    ctaTitle: "Приходи на бесплатное занятие и получи диагностику IELTS бесплатно",
    fullName: "ФИО",
    preferredBranch: "Какой филиал вам ближе?",
    phone: "Номер телефона",
    submit: "Оставить заявку",
    locationsTitle: "Наши филиалы на карте",
    offer: "Публичный Договор-Оферты",
  },
  en: {
    menuAbout: "About",
    menuTeachers: "Our Teachers",
    menuSuccess: "Success",
    menuReviews: "Reviews",
    menuLocations: "Branches",
    login: "Login",
    schedule: "Class Schedule",
    whyChoose: "Why choose us",
    teachersTitle: "Our Teachers",
    teachersSubtitle: "A strong IELTS-focused team committed to measurable results.",
    alumni: "Alumni Success",
    socialTalk: "What do people say about us on social media?",
    ctaTitle: "Come to a free class and get a free IELTS diagnostic",
    fullName: "Full Name",
    preferredBranch: "Which branch is closer to you?",
    phone: "Phone Number",
    submit: "Submit",
    locationsTitle: "Our branch locations",
    offer: "Public Offer Agreement",
  },
  kk: {
    menuAbout: "Біз туралы",
    menuTeachers: "Біздің оқытушылар",
    menuSuccess: "Жетістіктер",
    menuReviews: "Пікірлер",
    menuLocations: "Филиалдар",
    login: "Кіру",
    schedule: "Сабақ кестесі",
    whyChoose: "Неге бізді таңдайды",
    teachersTitle: "Біздің оқытушылар",
    teachersSubtitle: "IELTS нәтижесіне бағытталған мықты оқытушылар командасы.",
    alumni: "Түлектер жетістігі",
    socialTalk: "Әлеуметтік желілерде біз туралы не айтады?",
    ctaTitle: "Тегін сабаққа келіп, IELTS диагностикасын тегін алыңыз",
    fullName: "Аты-жөні",
    preferredBranch: "Сізге қай филиал жақын?",
    phone: "Телефон нөмірі",
    submit: "Өтінім жіберу",
    locationsTitle: "Филиалдар картасы",
    offer: "Қоғамдық Оферта Келісімі",
  },
};

const defaultImages = {
  hero: "https://images.unsplash.com/photo-1741699428553-41c8e5bd894d?crop=entropy&cs=srgb&fm=jpg&q=85",
  classroom: "https://images.unsplash.com/photo-1758685848174-e061c6486651?crop=entropy&cs=srgb&fm=jpg&q=85",
  success: "https://images.unsplash.com/photo-1758270703124-b65dce9a2bec?crop=entropy&cs=srgb&fm=jpg&q=85",
};

const getLocalized = (obj, lang) => {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[lang] || obj.ru || obj.en || "";
};

const applyTheme = (colors) => {
  if (!colors) return;
  const root = document.documentElement;
  root.style.setProperty("--primary", colors.primary || "#1e3a8a");
  root.style.setProperty("--secondary", colors.secondary || "#4b5563");
  root.style.setProperty("--accent", colors.accent || "#dc2626");
  root.style.setProperty("--background", colors.background || "#ffffff");
  root.style.setProperty("--surface", colors.surface || "#f9fafb");
  root.style.setProperty("--text-main", colors.text_main || "#111827");
};

export default function PublicHomePage() {
  const { user, isAuthenticated } = useAuth();
  const [lang, setLang] = useState("ru");
  const [branches, setBranches] = useState([]);
  const [publicBranchId, setPublicBranchId] = useState("");
  const [settings, setSettings] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState({ full_name: "", preferred_branch_id: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  const text = useMemo(() => STATIC_TEXT[lang], [lang]);

  const loadBranches = async () => {
    const response = await api.get("/api/public/branches");
    setBranches(response.data);
    const initial = response.data[0]?.id;
    if (initial) {
      setPublicBranchId(initial);
      setForm((prev) => ({ ...prev, preferred_branch_id: initial }));
    }
  };

  const loadPublicData = async (selectedBranchId) => {
    const [settingsResponse, teachersResponse] = await Promise.all([
      api.get("/api/public/settings", { params: { branch_id: selectedBranchId } }),
      api.get("/api/public/teachers", { params: { branch_id: selectedBranchId } }),
    ]);
    setSettings(settingsResponse.data);
    setTeachers(teachersResponse.data);
    applyTheme(settingsResponse.data.colors);
  };

  useEffect(() => {
    loadBranches().catch(() => toast.error("Не удалось загрузить филиалы"));
  }, []);

  useEffect(() => {
    if (!publicBranchId) return;
    loadPublicData(publicBranchId).catch(() => toast.error("Не удалось загрузить сайт"));
  }, [publicBranchId]);

  const submitLead = async (event) => {
    event.preventDefault();
    if (!form.full_name || !form.phone || !form.preferred_branch_id) {
      toast.error("Заполните ФИО, филиал и номер телефона");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/public/leads", {
        branch_id: form.preferred_branch_id,
        full_name: form.full_name,
        phone: form.phone,
      });
      toast.success("Ваша заявка принята");
      setForm((prev) => ({ ...prev, full_name: "", phone: "" }));
    } catch {
      toast.error("Ошибка отправки заявки");
    } finally {
      setSubmitting(false);
    }
  };

  const content = settings?.content || {};
  const social = settings?.social_links || {};
  const testimonials = settings?.testimonials || [];
  const metrics = settings?.success_metrics || [];
  const mapLocations = useMemo(
    () =>
      (settings?.map_locations || [])
        .map((item) => ({
          ...item,
          lat: Number(item.lat),
          lng: Number(item.lng),
        }))
        .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)),
    [settings?.map_locations]
  );
  const mapCenter = mapLocations[0] ? [mapLocations[0].lat, mapLocations[0].lng] : [43.238949, 76.889709];

  return (
    <div className="public-page" data-testid="public-page-root">
      <header className="top-header" data-testid="public-top-header">
        <div className="container nav-grid">
          <div className="brand-block" data-testid="header-brand-block">
            <img
              src={settings?.logo_url || defaultImages.classroom}
              alt="logo"
              className="logo"
              data-testid="header-logo-image"
            />
            <span className="brand-name" data-testid="header-brand-name">
              {settings?.brand_name || "IELTS Center"}
            </span>
          </div>

          <nav className="center-nav" data-testid="header-nav-menu">
            <a href="#about" data-testid="menu-link-about">{text.menuAbout}</a>
            <a href="#teachers" data-testid="menu-link-teachers">{text.menuTeachers}</a>
            <a href="#success" data-testid="menu-link-success">{text.menuSuccess}</a>
            <a href="#reviews" data-testid="menu-link-reviews">{text.menuReviews}</a>
            <a href="#locations" data-testid="menu-link-locations">{text.menuLocations}</a>
          </nav>

          <div className="right-actions" data-testid="header-right-actions">
            <div className="lang-switch" data-testid="language-switcher">
              <Languages size={16} />
              {LANGS.map((item) => (
                <button
                  key={item.code}
                  className={lang === item.code ? "lang-btn active" : "lang-btn"}
                  onClick={() => setLang(item.code)}
                  data-testid={`language-btn-${item.code}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="social-icons" data-testid="header-social-icons">
              <a href={social.instagram || "#"} target="_blank" rel="noreferrer" data-testid="social-instagram-link">
                <Instagram size={16} />
              </a>
              <a href={social.facebook || "#"} target="_blank" rel="noreferrer" data-testid="social-facebook-link">
                <Facebook size={16} />
              </a>
              <a href={social.whatsapp || "#"} target="_blank" rel="noreferrer" data-testid="social-whatsapp-link">
                <MessageCircle size={16} />
              </a>
            </div>

            <span className="phone-line" data-testid="header-phone-number">
              <Phone size={16} /> {settings?.phone || "+7 (700) 000-00-00"}
            </span>

            {isAuthenticated && user?.role === "student" ? (
              <Link to="/student/schedule" className="primary-btn" data-testid="student-schedule-nav-button">
                <CalendarDays size={16} /> {text.schedule}
              </Link>
            ) : (
              <Link to="/login" className="primary-btn" data-testid="header-login-button">
                {text.login}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="hero-section" data-testid="hero-section">
          <img src={defaultImages.hero} alt="hero" className="hero-image" data-testid="hero-background-image" />
          <div className="hero-overlay">
            <div className="container">
              <div className="hero-content" data-testid="hero-content-block">
                <h1 data-testid="hero-title">{getLocalized(content.hero_title, lang)}</h1>
                <p data-testid="hero-subtitle">{getLocalized(content.hero_subtitle, lang)}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="content-section" data-testid="about-section">
          <div className="container split-grid">
            <div data-testid="about-text-block">
              <h2>{getLocalized(content.about_title, lang)}</h2>
              <p>{getLocalized(content.about_text, lang)}</p>
              <h3>{text.whyChoose}</h3>
              <ul className="feature-list" data-testid="why-choose-list">
                <li data-testid="why-choose-item-1">Опытные преподаватели IELTS с международной практикой</li>
                <li data-testid="why-choose-item-2">Персональные стратегии под ваш текущий уровень</li>
                <li data-testid="why-choose-item-3">Регулярные пробные тесты и аналитика прогресса</li>
              </ul>
            </div>
            <div className="image-frame" data-testid="about-image-frame">
              <img src={defaultImages.classroom} alt="classroom" data-testid="about-image" />
            </div>
          </div>
        </section>

        <section id="teachers" className="content-section surface" data-testid="teachers-section">
          <div className="container">
            <h2 data-testid="teachers-title">{text.teachersTitle}</h2>
            <p data-testid="teachers-subtitle">{text.teachersSubtitle}</p>
            <div className="teacher-grid" data-testid="teachers-grid">
              {(teachers || []).map((teacher, index) => (
                <article key={teacher.id} className="teacher-card" data-testid={`teacher-card-${index + 1}`}>
                  <img
                    src={teacher.image_url || defaultImages.classroom}
                    alt={teacher.name}
                    data-testid={`teacher-image-${index + 1}`}
                  />
                  <div>
                    <h3 data-testid={`teacher-name-${index + 1}`}>{teacher.name}</h3>
                    <p data-testid={`teacher-specialization-${index + 1}`}>{teacher.specialization || "IELTS Instructor"}</p>
                    <small data-testid={`teacher-bio-${index + 1}`}>{getLocalized(teacher.bio, lang)}</small>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="success" className="content-section" data-testid="success-section">
          <div className="container">
            <h2 data-testid="success-title">{text.alumni}</h2>
            <div className="metrics-grid" data-testid="success-metrics-grid">
              {metrics.map((metric, index) => (
                <div key={metric.label} className="metric-card" data-testid={`success-metric-card-${index + 1}`}>
                  <strong data-testid={`success-metric-value-${index + 1}`}>{metric.value}</strong>
                  <span data-testid={`success-metric-label-${index + 1}`}>{metric.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="locations" className="content-section" data-testid="locations-section">
          <div className="container">
            <h2 data-testid="locations-title">{text.locationsTitle}</h2>
            <div className="locations-grid" data-testid="locations-grid">
              <div className="map-box" data-testid="locations-map-box">
                <MapContainer center={mapCenter} zoom={11} style={{ width: "100%", height: "420px" }} data-testid="locations-map-container">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {mapLocations.map((location) => (
                    <Marker key={location.id || `${location.lat}-${location.lng}`} position={[location.lat, location.lng]} icon={markerIcon}>
                      <Popup>
                        <strong>{location.title}</strong>
                        <br />
                        {location.address}
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
              <div className="location-list" data-testid="location-list">
                {mapLocations.map((location, index) => (
                  <article key={location.id || `${location.lat}-${location.lng}`} className="location-card" data-testid={`location-card-${index + 1}`}>
                    <h3 data-testid={`location-title-${index + 1}`}>
                      <MapPin size={16} /> {location.title}
                    </h3>
                    <p data-testid={`location-address-${index + 1}`}>{location.address}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="reviews" className="content-section surface" data-testid="reviews-section">
          <div className="container">
            <h2 data-testid="reviews-title">{text.socialTalk}</h2>
            <div className="review-grid" data-testid="review-grid">
              {testimonials.map((review, index) => (
                <article key={review.id} className="review-card" data-testid={`review-card-${index + 1}`}>
                  <img src={review.image_url} alt={review.name} data-testid={`review-image-${index + 1}`} />
                  <div>
                    <div className="review-top" data-testid={`review-top-${index + 1}`}>
                      {review.platform === "instagram" && <Instagram size={16} />}
                      {review.platform === "facebook" && <Facebook size={16} />}
                      {review.platform === "whatsapp" && <MessageCircle size={16} />}
                      <h4 data-testid={`review-name-${index + 1}`}>{review.name}</h4>
                    </div>
                    <p data-testid={`review-text-${index + 1}`}>{getLocalized(review.text, lang)}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="content-section" data-testid="cta-form-section">
          <div className="container cta-box">
            <h2 data-testid="cta-title">{getLocalized(content.offer_title, lang) || text.ctaTitle}</h2>
            <form onSubmit={submitLead} className="cta-form" data-testid="consultation-form">
              <input
                value={form.full_name}
                onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
                placeholder={text.fullName}
                data-testid="consultation-input-full-name"
              />
              <select
                value={form.preferred_branch_id}
                onChange={(event) => setForm((prev) => ({ ...prev, preferred_branch_id: event.target.value }))}
                data-testid="consultation-branch-select"
              >
                <option value="">{text.preferredBranch}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} — {branch.location}
                  </option>
                ))}
              </select>
              <input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder={text.phone}
                data-testid="consultation-input-phone"
              />
              <button type="submit" disabled={submitting} className="primary-btn" data-testid="consultation-submit-button">
                {submitting ? "..." : text.submit}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="footer" data-testid="public-footer">
        <div className="container footer-grid">
          <div className="brand-block" data-testid="footer-brand-block">
            <img
              src={settings?.logo_url || defaultImages.classroom}
              alt="logo"
              className="logo"
              data-testid="footer-logo-image"
            />
            <span className="brand-name" data-testid="footer-brand-name">
              {settings?.brand_name || "IELTS Center"}
            </span>
          </div>

          <div className="social-icons" data-testid="footer-social-icons">
            <a href={social.instagram || "#"} target="_blank" rel="noreferrer" data-testid="footer-social-instagram-link">
              <Instagram size={16} />
            </a>
            <a href={social.facebook || "#"} target="_blank" rel="noreferrer" data-testid="footer-social-facebook-link">
              <Facebook size={16} />
            </a>
            <a href={social.whatsapp || "#"} target="_blank" rel="noreferrer" data-testid="footer-social-whatsapp-link">
              <MessageCircle size={16} />
            </a>
          </div>

          <a href="#" className="offer-link" data-testid="footer-offer-link">
            {text.offer}
          </a>
        </div>
      </footer>
    </div>
  );
}
