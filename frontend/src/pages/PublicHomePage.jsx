import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, MessageCircle, Phone, Languages, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

const LANGS = [
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
  { code: "kk", label: "KK" },
];

const STATIC_TEXT = {
  ru: {
    menuAbout: "О нас",
    menuProgram: "Программа",
    menuSuccess: "Успехи",
    menuReviews: "Отзывы",
    login: "Войти",
    schedule: "Расписание занятий",
    whyChoose: "Почему выбирают нас",
    courseProgram: "Программа курса",
    durationInfo: "Длительность курса зависит от уровня студента. Уровень определяем бесплатно в нашем центре.",
    alumni: "Успехи выпускников",
    consult: "Для записи на индивидуальную консультацию",
    socialTalk: "Что о нас говорят в соц.сетях?",
    ctaTitle: "Приходи на бесплатное занятие и получи диагностику IELTS бесплатно",
    fullName: "ФИО",
    phone: "Номер телефона",
    submit: "Оставить заявку",
    offer: "Публичный Договор-Оферты",
  },
  en: {
    menuAbout: "About",
    menuProgram: "Program",
    menuSuccess: "Success",
    menuReviews: "Reviews",
    login: "Login",
    schedule: "Class Schedule",
    whyChoose: "Why choose us",
    courseProgram: "Course Program",
    durationInfo: "Course duration depends on the student's level. Level check is free at our center.",
    alumni: "Alumni Success",
    consult: "For an individual consultation",
    socialTalk: "What do people say about us on social media?",
    ctaTitle: "Come to a free class and get a free IELTS diagnostic",
    fullName: "Full Name",
    phone: "Phone Number",
    submit: "Submit",
    offer: "Public Offer Agreement",
  },
  kk: {
    menuAbout: "Біз туралы",
    menuProgram: "Бағдарлама",
    menuSuccess: "Жетістіктер",
    menuReviews: "Пікірлер",
    login: "Кіру",
    schedule: "Сабақ кестесі",
    whyChoose: "Неге бізді таңдайды",
    courseProgram: "Курс бағдарламасы",
    durationInfo: "Курс ұзақтығы студент деңгейіне байланысты. Деңгейді орталығымызда тегін анықтаймыз.",
    alumni: "Түлектер жетістігі",
    consult: "Жеке консультацияға жазылу үшін",
    socialTalk: "Әлеуметтік желілерде біз туралы не айтады?",
    ctaTitle: "Тегін сабаққа келіп, IELTS диагностикасын тегін алыңыз",
    fullName: "Аты-жөні",
    phone: "Телефон нөмірі",
    submit: "Өтінім жіберу",
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
  const [branchId, setBranchId] = useState("");
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  const text = useMemo(() => STATIC_TEXT[lang], [lang]);

  const loadBranches = async () => {
    const response = await api.get("/api/public/branches");
    setBranches(response.data);
    const persisted = localStorage.getItem("public_branch_id");
    const initial = persisted && response.data.some((item) => item.id === persisted)
      ? persisted
      : response.data[0]?.id;
    if (initial) {
      setBranchId(initial);
    }
  };

  const loadSettings = async (selectedBranchId) => {
    if (!selectedBranchId) return;
    const response = await api.get("/api/public/settings", { params: { branch_id: selectedBranchId } });
    setSettings(response.data);
    applyTheme(response.data.colors);
  };

  useEffect(() => {
    loadBranches().catch(() => toast.error("Не удалось загрузить филиалы"));
  }, []);

  useEffect(() => {
    if (!branchId) return;
    localStorage.setItem("public_branch_id", branchId);
    loadSettings(branchId).catch(() => toast.error("Не удалось загрузить сайт"));
  }, [branchId]);

  const submitLead = async (event) => {
    event.preventDefault();
    if (!form.full_name || !form.phone) {
      toast.error("Заполните ФИО и номер телефона");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/public/leads", { branch_id: branchId, ...form });
      toast.success("Ваша заявка принята");
      setForm({ full_name: "", phone: "" });
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
  const courseItems = settings?.course_program?.items || [];

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
            <a href="#program" data-testid="menu-link-program">{text.menuProgram}</a>
            <a href="#success" data-testid="menu-link-success">{text.menuSuccess}</a>
            <a href="#reviews" data-testid="menu-link-reviews">{text.menuReviews}</a>
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
                <div className="hero-controls" data-testid="hero-controls-row">
                  <select
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                    data-testid="branch-selector-public"
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} — {branch.location}
                      </option>
                    ))}
                  </select>
                </div>
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

        <section id="program" className="content-section surface" data-testid="program-section">
          <div className="container split-grid">
            <div data-testid="program-left-column">
              <h2>{text.courseProgram}</h2>
              <p>{text.durationInfo}</p>
            </div>
            <div className="program-card" data-testid="program-card">
              <p className="program-strong" data-testid="program-lessons-per-month">
                {settings?.course_program?.lessons_per_month || "12 занятий/мес."}
              </p>
              <p className="program-strong" data-testid="program-frequency">
                {settings?.course_program?.frequency || "3 раза в неделю по 90 минут"}
              </p>
              <ul data-testid="program-item-list">
                {courseItems.map((item, index) => (
                  <li key={`${item}-${index}`} data-testid={`program-item-${index + 1}`}>{item}</li>
                ))}
              </ul>
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

            <div className="consult-row" data-testid="consultation-info-row">
              <p data-testid="consultation-text">{getLocalized(content.consultation_title, lang)}</p>
              <div className="social-icons" data-testid="consultation-social-links">
                <a href={social.whatsapp || "#"} target="_blank" rel="noreferrer" data-testid="consultation-whatsapp-link">
                  <MessageCircle size={16} />
                </a>
                <a href={social.instagram || "#"} target="_blank" rel="noreferrer" data-testid="consultation-instagram-link">
                  <Instagram size={16} />
                </a>
                <a href={social.facebook || "#"} target="_blank" rel="noreferrer" data-testid="consultation-facebook-link">
                  <Facebook size={16} />
                </a>
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
