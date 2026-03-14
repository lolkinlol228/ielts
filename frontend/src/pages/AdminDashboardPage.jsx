import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Building2, CalendarClock, GraduationCap, KeyRound, LogOut, Palette, Settings, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { api, authConfig } from "../lib/api";

const TABS = [
  { id: "overview", label: "Обзор", icon: ShieldCheck },
  { id: "branches", label: "Филиалы", icon: Building2 },
  { id: "site", label: "Редактор сайта", icon: Palette },
  { id: "leads", label: "Желающие", icon: Users },
  { id: "students", label: "Ученики", icon: Users },
  { id: "resources", label: "Преподы / классы", icon: Building2 },
  { id: "groups", label: "Группы и переводы", icon: Settings },
  { id: "graduates", label: "Выпускники", icon: GraduationCap },
  { id: "schedule", label: "Расписание", icon: CalendarClock },
  { id: "account", label: "Аккаунт", icon: KeyRound },
];

const defaultSiteDraft = {
  brand_name: "IELTS Center",
  logo_url: "",
  phone: "",
  social_links: { instagram: "", facebook: "", whatsapp: "" },
  colors: {
    primary: "#1e3a8a",
    secondary: "#4b5563",
    accent: "#dc2626",
    background: "#ffffff",
    surface: "#f9fafb",
    text_main: "#111827",
  },
  content: {
    hero_title: { ru: "", en: "", kk: "" },
    hero_subtitle: { ru: "", en: "", kk: "" },
    about_title: { ru: "", en: "", kk: "" },
    about_text: { ru: "", en: "", kk: "" },
    why_choose_title: { ru: "", en: "", kk: "" },
    consultation_title: { ru: "", en: "", kk: "" },
    offer_title: { ru: "", en: "", kk: "" },
  },
  testimonials: [],
  map_locations: [],
};

const defaultScheduleConfig = {
  start_time: "08:00",
  end_time: "17:00",
  lunch_start: "12:00",
  lunch_end: "13:00",
  lesson_duration: 120,
  break_duration: 0,
};

const DAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

const applyTheme = (colors) => {
  if (!colors) return;
  const root = document.documentElement;
  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--secondary", colors.secondary);
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--background", colors.background);
  root.style.setProperty("--surface", colors.surface);
  root.style.setProperty("--text-main", colors.text_main);
};

export default function AdminDashboardPage() {
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [newBranch, setNewBranch] = useState({ name: "", location: "" });
  const [branchDrafts, setBranchDrafts] = useState({});

  const [siteDraft, setSiteDraft] = useState(defaultSiteDraft);
  const [leads, setLeads] = useState([]);
  const [graduates, setGraduates] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [groups, setGroups] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [scheduleConfig, setScheduleConfig] = useState(defaultScheduleConfig);
  const [autoSlots, setAutoSlots] = useState([]);

  const [teacherForm, setTeacherForm] = useState({
    name: "",
    phone: "",
    image_url: "",
    specialization: "",
    bio: { ru: "", en: "", kk: "" },
  });
  const [classroomForm, setClassroomForm] = useState({ name: "", capacity: "" });
  const [groupForm, setGroupForm] = useState({ prefix: "ielts", index: 1, year: 2025, is_individual: false });
  const [assignForm, setAssignForm] = useState({ student_id: "", group_id: "" });
  const [transferForm, setTransferForm] = useState({ student_id: "", from_group_id: "", to_group_id: "" });
  const [scheduleForm, setScheduleForm] = useState({ day: "ПН", start: "08:00", end: "10:00", group_id: "", teacher_id: "", classroom_id: "" });
  const [editingScheduleId, setEditingScheduleId] = useState("");
  const [conflictState, setConflictState] = useState(null);

  const [credentialsDraft, setCredentialsDraft] = useState({});
  const [teacherDrafts, setTeacherDrafts] = useState({});
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState("all");
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [graduateSearchQuery, setGraduateSearchQuery] = useState("");
  const [selectedGraduateIds, setSelectedGraduateIds] = useState([]);
  const [adminCredentialsForm, setAdminCredentialsForm] = useState({
    current_password: "",
    new_username: user?.username || "",
    new_password: "",
  });
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    action: null,
  });

  const config = useMemo(() => authConfig(token), [token]);

  if (!user || !["superadmin", "admin"].includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  const loadBranches = async () => {
    const response = await api.get("/api/admin/branches", config);
    setBranches(response.data);
    const persisted = localStorage.getItem("admin_branch_id");
    const allowedPersisted = response.data.find((branch) => branch.id === persisted)?.id;
    const defaultBranch = user?.branch_id || allowedPersisted || response.data[0]?.id || "";
    setSelectedBranchId(defaultBranch);
  };

  const withBranch = () => ({ params: { branch_id: selectedBranchId }, ...config });

  const openConfirmDialog = (title, message, action) => {
    setConfirmDialog({ open: true, title, message, action });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, title: "", message: "", action: null });
  };

  const executeConfirmDialogAction = async () => {
    if (typeof confirmDialog.action === "function") {
      await confirmDialog.action();
    }
    closeConfirmDialog();
  };

  const loadBranchData = async () => {
    if (!selectedBranchId) return;
    const requests = [
      api.get("/api/admin/site-settings", withBranch()),
      api.get("/api/admin/leads", withBranch()),
      api.get("/api/admin/graduates", withBranch()),
      api.get("/api/admin/students", withBranch()),
      api.get("/api/admin/teachers", withBranch()),
      api.get("/api/admin/classrooms", withBranch()),
      api.get("/api/admin/groups", withBranch()),
      api.get("/api/admin/schedules", withBranch()),
      api.get("/api/admin/schedule-settings", withBranch()),
    ];

    const [site, leadsRes, graduatesRes, studentsRes, teachersRes, classRes, groupsRes, schedulesRes, configRes] = await Promise.all(requests);
    setSiteDraft(site.data);
    applyTheme(site.data.colors);
    setLeads(leadsRes.data);
    setGraduates(graduatesRes.data);
    setStudents(studentsRes.data);
    setTeachers(teachersRes.data);
    setClassrooms(classRes.data);
    setGroups(groupsRes.data);
    setSchedules(schedulesRes.data);
    setScheduleConfig(configRes.data);
  };

  useEffect(() => {
    loadBranches().catch(() => toast.error("Не удалось загрузить филиалы"));
  }, []);

  useEffect(() => {
    if (!selectedBranchId) return;
    localStorage.setItem("admin_branch_id", selectedBranchId);
    setSelectedLeadIds([]);
    setSelectedGraduateIds([]);
    loadBranchData().catch(() => toast.error("Не удалось загрузить данные филиала"));
  }, [selectedBranchId]);

  useEffect(() => {
    const nextDrafts = {};
    branches.forEach((branch) => {
      nextDrafts[branch.id] = {
        name: branch.name,
        location: branch.location,
      };
    });
    setBranchDrafts(nextDrafts);
  }, [branches]);

  useEffect(() => {
    const nextDrafts = {};
    teachers.forEach((teacher) => {
      nextDrafts[teacher.id] = {
        name: teacher.name || "",
        phone: teacher.phone || "",
        image_url: teacher.image_url || "",
        specialization: teacher.specialization || "",
        bio: {
          ru: teacher.bio?.ru || "",
          en: teacher.bio?.en || "",
          kk: teacher.bio?.kk || "",
        },
      };
    });
    setTeacherDrafts(nextDrafts);
  }, [teachers]);

  useEffect(() => {
    setAdminCredentialsForm((prev) => ({ ...prev, new_username: user?.username || prev.new_username }));
  }, [user?.username]);

  const createBranch = async () => {
    if (!newBranch.name || !newBranch.location) {
      toast.error("Заполните название и местоположение");
      return;
    }
    try {
      await api.post("/api/admin/branches", newBranch, config);
      toast.success("Филиал создан");
      setNewBranch({ name: "", location: "" });
      await loadBranches();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Ошибка создания филиала");
    }
  };

  const saveBranch = async (branchId) => {
    const payload = branchDrafts[branchId];
    if (!payload?.name || !payload?.location) {
      toast.error("Название и местоположение обязательны");
      return;
    }
    try {
      await api.put(`/api/admin/branches/${branchId}`, payload, config);
      await loadBranches();
      toast.success("Филиал обновлён");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Ошибка обновления филиала");
    }
  };

  const removeBranch = async (branchId) => {
    try {
      await api.delete(`/api/admin/branches/${branchId}`, config);
      await loadBranches();
      toast.success("Филиал удалён");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Ошибка удаления филиала");
    }
  };

  const saveSiteSettings = async () => {
    try {
      await api.put("/api/admin/site-settings", {
        brand_name: siteDraft.brand_name,
        logo_url: siteDraft.logo_url,
        phone: siteDraft.phone,
        social_links: siteDraft.social_links,
        colors: siteDraft.colors,
        content: siteDraft.content,
        testimonials: siteDraft.testimonials,
        map_locations: siteDraft.map_locations,
      }, withBranch());
      applyTheme(siteDraft.colors);
      toast.success("Изменения сайта сохранены");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Не удалось сохранить");
    }
  };

  const approveLead = async (leadId) => {
    try {
      const response = await api.post(`/api/admin/leads/${leadId}/approve`, {}, withBranch());
      toast.success(`Логин: ${response.data.username}, пароль: ${response.data.password}`);
      await loadBranchData();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Ошибка подтверждения");
    }
  };

  const rejectLead = async (leadId) => {
    try {
      await api.post(`/api/admin/leads/${leadId}/reject`, {}, withBranch());
      await loadBranchData();
      toast.success("Заявка отклонена");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Ошибка отклонения");
    }
  };

  const toggleLeadSelection = (leadId) => {
    setSelectedLeadIds((prev) => (prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]));
  };

  const deleteSelectedLeads = async () => {
    if (selectedLeadIds.length === 0) {
      toast.error("Выберите заявки");
      return;
    }
    try {
      await api.post("/api/admin/leads/delete-selected", { ids: selectedLeadIds }, withBranch());
      setSelectedLeadIds([]);
      await loadBranchData();
      toast.success("Выбранные заявки удалены");
    } catch {
      toast.error("Ошибка удаления заявок");
    }
  };

  const deleteAllLeads = async () => {
    try {
      await api.delete("/api/admin/leads", withBranch());
      setSelectedLeadIds([]);
      await loadBranchData();
      toast.success("Все заявки удалены");
    } catch {
      toast.error("Ошибка удаления заявок");
    }
  };

  const toggleGraduateSelection = (graduateId) => {
    setSelectedGraduateIds((prev) => (prev.includes(graduateId) ? prev.filter((id) => id !== graduateId) : [...prev, graduateId]));
  };

  const deleteSelectedGraduates = async () => {
    if (selectedGraduateIds.length === 0) {
      toast.error("Выберите выпускников");
      return;
    }
    try {
      await api.post("/api/admin/graduates/delete-selected", { ids: selectedGraduateIds }, withBranch());
      setSelectedGraduateIds([]);
      await loadBranchData();
      toast.success("Выбранные выпускники удалены");
    } catch {
      toast.error("Ошибка удаления выпускников");
    }
  };

  const deleteAllGraduates = async () => {
    try {
      await api.delete("/api/admin/graduates", withBranch());
      setSelectedGraduateIds([]);
      await loadBranchData();
      toast.success("Список выпускников очищен");
    } catch {
      toast.error("Ошибка очистки выпускников");
    }
  };

  const saveStudentCredentials = async (studentId) => {
    const payload = credentialsDraft[studentId];
    if (!payload?.username || !payload?.password) {
      toast.error("Введите логин и пароль");
      return;
    }
    try {
      await api.put(`/api/admin/students/${studentId}/credentials`, payload, withBranch());
      toast.success("Данные входа обновлены");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Ошибка обновления");
    }
  };

  const addTeacher = async () => {
    if (!teacherForm.name || !teacherForm.phone) {
      toast.error("Заполните данные преподавателя");
      return;
    }
    try {
      await api.post("/api/admin/teachers", teacherForm, withBranch());
      setTeacherForm({
        name: "",
        phone: "",
        image_url: "",
        specialization: "",
        bio: { ru: "", en: "", kk: "" },
      });
      await loadBranchData();
      toast.success("Преподаватель добавлен");
    } catch {
      toast.error("Ошибка добавления преподавателя");
    }
  };

  const saveTeacher = async (teacherId) => {
    const payload = teacherDrafts[teacherId];
    if (!payload?.name || !payload?.phone) {
      toast.error("Для сохранения заполните имя и телефон преподавателя");
      return;
    }
    try {
      await api.put(`/api/admin/teachers/${teacherId}`, payload, withBranch());
      await loadBranchData();
      toast.success("Преподаватель обновлён");
    } catch {
      toast.error("Ошибка обновления преподавателя");
    }
  };

  const removeTeacher = async (teacherId) => {
    try {
      await api.delete(`/api/admin/teachers/${teacherId}`, withBranch());
      await loadBranchData();
      toast.success("Преподаватель удалён");
    } catch {
      toast.error("Ошибка удаления преподавателя");
    }
  };

  const addTestimonial = () => {
    setSiteDraft((prev) => ({
      ...prev,
      testimonials: [
        ...(prev.testimonials || []),
        {
          id: crypto.randomUUID(),
          name: "",
          platform: "instagram",
          image_url: "",
          text: { ru: "", en: "", kk: "" },
        },
      ],
    }));
  };

  const removeTestimonial = (id) => {
    setSiteDraft((prev) => ({
      ...prev,
      testimonials: (prev.testimonials || []).filter((item) => item.id !== id),
    }));
  };

  const addMapLocation = () => {
    setSiteDraft((prev) => ({
      ...prev,
      map_locations: [
        ...(prev.map_locations || []),
        {
          id: crypto.randomUUID(),
          title: "",
          address: "",
          lat: 43.238949,
          lng: 76.889709,
        },
      ],
    }));
  };

  const removeMapLocation = (id) => {
    setSiteDraft((prev) => ({
      ...prev,
      map_locations: (prev.map_locations || []).filter((item) => item.id !== id),
    }));
  };

  const addClassroom = async () => {
    if (!classroomForm.name) {
      toast.error("Введите номер или название класса");
      return;
    }
    try {
      await api.post("/api/admin/classrooms", {
        name: classroomForm.name,
        capacity: classroomForm.capacity ? Number(classroomForm.capacity) : null,
      }, withBranch());
      setClassroomForm({ name: "", capacity: "" });
      await loadBranchData();
      toast.success("Класс добавлен");
    } catch {
      toast.error("Ошибка добавления класса");
    }
  };

  const removeClassroom = async (classroomId) => {
    try {
      await api.delete(`/api/admin/classrooms/${classroomId}`, withBranch());
      await loadBranchData();
      toast.success("Класс удалён");
    } catch {
      toast.error("Ошибка удаления класса");
    }
  };

  const addGroup = async () => {
    try {
      await api.post("/api/admin/groups", {
        prefix: groupForm.prefix,
        index: Number(groupForm.index),
        year: Number(groupForm.year),
        is_individual: groupForm.is_individual,
      }, withBranch());
      await loadBranchData();
      toast.success("Группа создана");
    } catch {
      toast.error("Ошибка создания группы");
    }
  };

  const removeGroup = async (groupId) => {
    try {
      await api.delete(`/api/admin/groups/${groupId}`, withBranch());
      await loadBranchData();
      toast.success("Группа удалена");
    } catch {
      toast.error("Ошибка удаления группы");
    }
  };

  const assignStudent = async () => {
    if (!assignForm.student_id || !assignForm.group_id) {
      toast.error("Выберите ученика и группу");
      return;
    }
    try {
      await api.post(`/api/admin/groups/${assignForm.group_id}/students/${assignForm.student_id}`, {}, withBranch());
      await loadBranchData();
      toast.success("Ученик добавлен в группу");
    } catch {
      toast.error("Ошибка привязки ученика");
    }
  };

  const transferStudent = async () => {
    if (!transferForm.student_id || !transferForm.from_group_id || !transferForm.to_group_id) {
      toast.error("Заполните перевод полностью");
      return;
    }
    try {
      await api.post(`/api/admin/students/${transferForm.student_id}/transfer`, {
        from_group_id: transferForm.from_group_id,
        to_group_id: transferForm.to_group_id,
      }, withBranch());
      await loadBranchData();
      toast.success("Перевод выполнен");
    } catch {
      toast.error("Ошибка перевода");
    }
  };

  const graduateGroup = async (groupId) => {
    try {
      const response = await api.post(`/api/admin/groups/${groupId}/graduate`, {}, withBranch());
      await loadBranchData();
      toast.success(`${response.data.message}. Выпущено: ${response.data.graduates_count}`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Ошибка выпуска группы");
    }
  };

  const saveScheduleConfig = async () => {
    try {
      await api.put("/api/admin/schedule-settings", {
        ...scheduleConfig,
        lesson_duration: Number(scheduleConfig.lesson_duration),
        break_duration: Number(scheduleConfig.break_duration),
      }, withBranch());
      toast.success("Настройки расписания сохранены");
    } catch {
      toast.error("Ошибка сохранения настроек");
    }
  };

  const generateAutoSlots = async (silent = false) => {
    try {
      const response = await api.post("/api/admin/schedule/auto-slots", {
        ...scheduleConfig,
        lesson_duration: Number(scheduleConfig.lesson_duration),
        break_duration: Number(scheduleConfig.break_duration),
      }, withBranch());
      setAutoSlots(response.data.slots);
      if (!silent) {
        toast.success("Слоты рассчитаны");
      }
    } catch {
      if (!silent) {
        toast.error("Ошибка расчёта слотов");
      }
    }
  };

  const saveAdminCredentials = async () => {
    if (!adminCredentialsForm.current_password || !adminCredentialsForm.new_username || !adminCredentialsForm.new_password) {
      toast.error("Заполните все поля аккаунта");
      return;
    }
    try {
      await api.put("/api/admin/me/credentials", adminCredentialsForm, config);
      toast.success("Данные аккаунта обновлены. Войдите заново.");
      logout();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Ошибка обновления аккаунта");
    }
  };

  const createScheduleEntry = async () => {
    if (!scheduleForm.group_id || !scheduleForm.teacher_id || !scheduleForm.classroom_id) {
      toast.error("Заполните все поля расписания");
      return;
    }
    try {
      if (editingScheduleId) {
        await api.put(`/api/admin/schedules/${editingScheduleId}`, scheduleForm, withBranch());
      } else {
        await api.post("/api/admin/schedules", scheduleForm, withBranch());
      }
      setConflictState(null);
      setEditingScheduleId("");
      setScheduleForm({ day: "ПН", start: "08:00", end: "10:00", group_id: "", teacher_id: "", classroom_id: "" });
      await loadBranchData();
      toast.success(editingScheduleId ? "Расписание обновлено" : "Расписание сохранено");
    } catch (error) {
      const details = error?.response?.data?.detail;
      if (details?.has_conflict) {
        setConflictState(details);
      }
      toast.error(editingScheduleId ? "Не удалось обновить расписание" : "Не удалось сохранить расписание");
    }
  };

  const editSchedule = (schedule) => {
    setEditingScheduleId(schedule.id);
    setScheduleForm({
      day: schedule.day,
      start: schedule.start,
      end: schedule.end,
      group_id: schedule.group_id,
      teacher_id: schedule.teacher_id,
      classroom_id: schedule.classroom_id,
    });
  };

  const cancelEditSchedule = () => {
    setEditingScheduleId("");
    setConflictState(null);
    setScheduleForm({ day: "ПН", start: "08:00", end: "10:00", group_id: "", teacher_id: "", classroom_id: "" });
  };

  const applyAutoSlot = (slot) => {
    setScheduleForm((prev) => ({ ...prev, start: slot.start, end: slot.end }));
  };

  const removeSchedule = async (scheduleId) => {
    try {
      await api.delete(`/api/admin/schedules/${scheduleId}`, withBranch());
      await loadBranchData();
      toast.success("Запись удалена");
    } catch {
      toast.error("Ошибка удаления записи");
    }
  };

  useEffect(() => {
    const canCheck =
      selectedBranchId &&
      scheduleForm.day &&
      scheduleForm.start &&
      scheduleForm.end &&
      scheduleForm.teacher_id &&
      scheduleForm.classroom_id;
    if (!canCheck) {
      setConflictState(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await api.get("/api/admin/schedules/conflicts", {
          params: {
            branch_id: selectedBranchId,
            day: scheduleForm.day,
            start: scheduleForm.start,
            end: scheduleForm.end,
            teacher_id: scheduleForm.teacher_id,
            classroom_id: scheduleForm.classroom_id,
            schedule_id: editingScheduleId || undefined,
          },
          headers: config.headers,
        });
        setConflictState(response.data);
      } catch {
        setConflictState(null);
      }
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [
    selectedBranchId,
    scheduleForm.day,
    scheduleForm.start,
    scheduleForm.end,
    scheduleForm.teacher_id,
    scheduleForm.classroom_id,
    editingScheduleId,
    config.headers,
  ]);

  useEffect(() => {
    if (!selectedBranchId) return;
    const timeoutId = setTimeout(() => {
      generateAutoSlots(true);
    }, 350);
    return () => clearTimeout(timeoutId);
  }, [
    selectedBranchId,
    scheduleConfig.start_time,
    scheduleConfig.end_time,
    scheduleConfig.lunch_start,
    scheduleConfig.lunch_end,
    scheduleConfig.lesson_duration,
    scheduleConfig.break_duration,
  ]);

  const overviewStats = {
    leads: leads.filter((item) => item.status === "pending").length,
    students: students.length,
    teachers: teachers.length,
    groups: groups.length,
    schedules: schedules.length,
  };

  const filteredLeads = leads.filter((lead) => {
    const statusMatch = leadStatusFilter === "all" ? true : lead.status === leadStatusFilter;
    const query = leadSearchQuery.trim().toLowerCase();
    const queryMatch = !query || lead.full_name.toLowerCase().includes(query) || lead.phone.toLowerCase().includes(query);
    return statusMatch && queryMatch;
  });

  const filteredGraduates = graduates.filter((graduate) => {
    const query = graduateSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      graduate.full_name.toLowerCase().includes(query) ||
      (graduate.group_name || "").toLowerCase().includes(query) ||
      (graduate.phone || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="dashboard-page" data-testid="admin-dashboard-page">
      <aside className="sidebar" data-testid="admin-sidebar">
        <div className="sidebar-brand" data-testid="admin-sidebar-brand">
          <img src={siteDraft.logo_url} alt="logo" className="logo" data-testid="admin-sidebar-logo" />
          <div>
            <strong data-testid="admin-sidebar-brand-name">{siteDraft.brand_name || "IELTS Center"}</strong>
            <p data-testid="admin-sidebar-user-role">{user.role}</p>
          </div>
        </div>

        <div className="sidebar-tabs" data-testid="admin-tab-list">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "tab-btn active" : "tab-btn"}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`admin-tab-button-${tab.id}`}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        <button onClick={logout} className="danger-btn" data-testid="admin-logout-button">
          <LogOut size={16} /> Выйти
        </button>
      </aside>

      <main className="dashboard-content" data-testid="admin-main-content">
        <div className="dashboard-topbar" data-testid="admin-topbar">
          <div>
            <h1 data-testid="admin-topbar-title">Админ панель</h1>
            <p data-testid="admin-topbar-subtitle">Мультифилиалы, сайт, ученики, группы, расписание</p>
          </div>

          <div className="topbar-controls" data-testid="admin-topbar-controls">
            <select
              value={selectedBranchId}
              onChange={(event) => setSelectedBranchId(event.target.value)}
              data-testid="admin-branch-selector"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} — {branch.location}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeTab === "branches" && user.role === "superadmin" && (
          <section className="card" data-testid="branches-tab-content">
            <h2 data-testid="branch-creator-title">Управление филиалами</h2>
            <div className="inline-form" data-testid="branch-creator-card">
              <input
                placeholder="Название филиала"
                value={newBranch.name}
                onChange={(event) => setNewBranch((prev) => ({ ...prev, name: event.target.value }))}
                data-testid="branch-create-name-input"
              />
              <input
                placeholder="Местоположение"
                value={newBranch.location}
                onChange={(event) => setNewBranch((prev) => ({ ...prev, location: event.target.value }))}
                data-testid="branch-create-location-input"
              />
              <button className="primary-btn" onClick={createBranch} data-testid="branch-create-submit-button">
                Создать филиал
              </button>
            </div>

            <div className="table-like" data-testid="branch-management-list">
              {branches.map((branch) => (
                <div key={branch.id} className="row" data-testid={`branch-management-row-${branch.id}`}>
                  <input
                    value={branchDrafts[branch.id]?.name || ""}
                    onChange={(event) =>
                      setBranchDrafts((prev) => ({
                        ...prev,
                        [branch.id]: { ...prev[branch.id], name: event.target.value },
                      }))
                    }
                    data-testid={`branch-management-name-${branch.id}`}
                  />
                  <input
                    value={branchDrafts[branch.id]?.location || ""}
                    onChange={(event) =>
                      setBranchDrafts((prev) => ({
                        ...prev,
                        [branch.id]: { ...prev[branch.id], location: event.target.value },
                      }))
                    }
                    data-testid={`branch-management-location-${branch.id}`}
                  />
                  <button
                    className="primary-btn"
                    onClick={() => saveBranch(branch.id)}
                    data-testid={`branch-management-save-${branch.id}`}
                  >
                    Сохранить
                  </button>
                  <button
                    className="danger-btn"
                    onClick={() =>
                      openConfirmDialog(
                        "Удаление филиала",
                        "Это удалит БД филиала и пользователей филиала. Продолжить?",
                        () => removeBranch(branch.id)
                      )
                    }
                    data-testid={`branch-management-delete-${branch.id}`}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "overview" && (
          <section className="card" data-testid="overview-tab-content">
            <h2 data-testid="overview-title">Обзор филиала</h2>
            <div className="metrics-grid">
              <div className="metric-card" data-testid="overview-pending-leads-card">
                <strong>{overviewStats.leads}</strong>
                <span>Новые заявки</span>
              </div>
              <div className="metric-card" data-testid="overview-students-card">
                <strong>{overviewStats.students}</strong>
                <span>Ученики</span>
              </div>
              <div className="metric-card" data-testid="overview-teachers-card">
                <strong>{overviewStats.teachers}</strong>
                <span>Преподаватели</span>
              </div>
              <div className="metric-card" data-testid="overview-groups-card">
                <strong>{overviewStats.groups}</strong>
                <span>Группы</span>
              </div>
              <div className="metric-card" data-testid="overview-schedules-card">
                <strong>{overviewStats.schedules}</strong>
                <span>Занятия</span>
              </div>
            </div>
          </section>
        )}

        {activeTab === "site" && (
          <section className="card" data-testid="site-editor-tab-content">
            <h2 data-testid="site-editor-title">Редактирование сайта</h2>

            <div className="form-grid">
              <div>
                <label data-testid="site-editor-brand-name-label">Название бренда</label>
                <input
                  value={siteDraft.brand_name || ""}
                  onChange={(event) => setSiteDraft((prev) => ({ ...prev, brand_name: event.target.value }))}
                  data-testid="site-editor-brand-name-input"
                />
              </div>
              <div>
                <label data-testid="site-editor-logo-label">URL логотипа</label>
                <input
                  value={siteDraft.logo_url || ""}
                  onChange={(event) => setSiteDraft((prev) => ({ ...prev, logo_url: event.target.value }))}
                  data-testid="site-editor-logo-input"
                />
              </div>
              <div>
                <label data-testid="site-editor-phone-label">Телефон</label>
                <input
                  value={siteDraft.phone || ""}
                  onChange={(event) => setSiteDraft((prev) => ({ ...prev, phone: event.target.value }))}
                  data-testid="site-editor-phone-input"
                />
              </div>
              <div>
                <label data-testid="site-editor-instagram-label">Instagram</label>
                <input
                  value={siteDraft.social_links?.instagram || ""}
                  onChange={(event) =>
                    setSiteDraft((prev) => ({
                      ...prev,
                      social_links: { ...prev.social_links, instagram: event.target.value },
                    }))
                  }
                  data-testid="site-editor-instagram-input"
                />
              </div>
              <div>
                <label data-testid="site-editor-facebook-label">Facebook</label>
                <input
                  value={siteDraft.social_links?.facebook || ""}
                  onChange={(event) =>
                    setSiteDraft((prev) => ({
                      ...prev,
                      social_links: { ...prev.social_links, facebook: event.target.value },
                    }))
                  }
                  data-testid="site-editor-facebook-input"
                />
              </div>
              <div>
                <label data-testid="site-editor-whatsapp-label">WhatsApp</label>
                <input
                  value={siteDraft.social_links?.whatsapp || ""}
                  onChange={(event) =>
                    setSiteDraft((prev) => ({
                      ...prev,
                      social_links: { ...prev.social_links, whatsapp: event.target.value },
                    }))
                  }
                  data-testid="site-editor-whatsapp-input"
                />
              </div>
            </div>

            <h3 data-testid="site-editor-colors-title">Глобальные цвета</h3>
            <div className="color-grid" data-testid="site-editor-color-grid">
              {Object.entries(siteDraft.colors || {}).map(([key, value]) => (
                <label key={key} data-testid={`site-editor-color-${key}`}>
                  <span>{key}</span>
                  <input
                    type="color"
                    value={value}
                    onChange={(event) =>
                      setSiteDraft((prev) => ({
                        ...prev,
                        colors: { ...prev.colors, [key]: event.target.value },
                      }))
                    }
                    data-testid={`site-editor-color-picker-${key}`}
                  />
                </label>
              ))}
            </div>

            <h3 data-testid="site-editor-translations-title">Тексты RU / EN / KK</h3>
            <div className="translations-grid" data-testid="site-editor-translations-grid">
              {Object.keys(siteDraft.content || {}).map((contentKey) => (
                <div key={contentKey} className="translation-card" data-testid={`site-editor-content-${contentKey}`}>
                  <strong>{contentKey}</strong>
                  {["ru", "en", "kk"].map((langCode) => (
                    <textarea
                      key={`${contentKey}-${langCode}`}
                      placeholder={`${contentKey} (${langCode})`}
                      value={siteDraft.content?.[contentKey]?.[langCode] || ""}
                      onChange={(event) =>
                        setSiteDraft((prev) => ({
                          ...prev,
                          content: {
                            ...prev.content,
                            [contentKey]: {
                              ...prev.content[contentKey],
                              [langCode]: event.target.value,
                            },
                          },
                        }))
                      }
                      data-testid={`site-editor-content-${contentKey}-${langCode}`}
                    />
                  ))}
                </div>
              ))}
            </div>

            <div className="inline-form" data-testid="site-editor-testimonials-header">
              <h3 data-testid="site-editor-testimonials-title">Отзывы из соцсетей</h3>
              <button className="primary-btn" onClick={addTestimonial} data-testid="site-editor-add-testimonial-button">
                Добавить отзыв
              </button>
            </div>

            <div className="translations-grid" data-testid="site-editor-testimonials-list">
              {(siteDraft.testimonials || []).map((testimonial, index) => (
                <div key={testimonial.id} className="translation-card" data-testid={`site-editor-testimonial-card-${index + 1}`}>
                  <input
                    value={testimonial.name || ""}
                    placeholder="Имя"
                    onChange={(event) =>
                      setSiteDraft((prev) => ({
                        ...prev,
                        testimonials: (prev.testimonials || []).map((item) =>
                          item.id === testimonial.id ? { ...item, name: event.target.value } : item
                        ),
                      }))
                    }
                    data-testid={`site-editor-testimonial-name-${index + 1}`}
                  />
                  <select
                    value={testimonial.platform || "instagram"}
                    onChange={(event) =>
                      setSiteDraft((prev) => ({
                        ...prev,
                        testimonials: (prev.testimonials || []).map((item) =>
                          item.id === testimonial.id ? { ...item, platform: event.target.value } : item
                        ),
                      }))
                    }
                    data-testid={`site-editor-testimonial-platform-${index + 1}`}
                  >
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                  <input
                    value={testimonial.image_url || ""}
                    placeholder="URL фото"
                    onChange={(event) =>
                      setSiteDraft((prev) => ({
                        ...prev,
                        testimonials: (prev.testimonials || []).map((item) =>
                          item.id === testimonial.id ? { ...item, image_url: event.target.value } : item
                        ),
                      }))
                    }
                    data-testid={`site-editor-testimonial-image-${index + 1}`}
                  />
                  {[
                    { code: "ru", label: "Текст RU" },
                    { code: "en", label: "Text EN" },
                    { code: "kk", label: "Мәтін KK" },
                  ].map((langItem) => (
                    <textarea
                      key={`${testimonial.id}-${langItem.code}`}
                      value={testimonial.text?.[langItem.code] || ""}
                      placeholder={langItem.label}
                      onChange={(event) =>
                        setSiteDraft((prev) => ({
                          ...prev,
                          testimonials: (prev.testimonials || []).map((item) =>
                            item.id === testimonial.id
                              ? {
                                  ...item,
                                  text: { ...item.text, [langItem.code]: event.target.value },
                                }
                              : item
                          ),
                        }))
                      }
                      data-testid={`site-editor-testimonial-text-${index + 1}-${langItem.code}`}
                    />
                  ))}
                  <button
                    className="danger-btn"
                    onClick={() => removeTestimonial(testimonial.id)}
                    data-testid={`site-editor-testimonial-delete-${index + 1}`}
                  >
                    Удалить отзыв
                  </button>
                </div>
              ))}
            </div>

            <div className="inline-form" data-testid="site-editor-map-header">
              <h3 data-testid="site-editor-map-title">Точки филиалов на карте</h3>
              <button className="primary-btn" onClick={addMapLocation} data-testid="site-editor-add-map-location-button">
                Добавить точку
              </button>
            </div>

            <div className="translations-grid" data-testid="site-editor-map-location-list">
              {(siteDraft.map_locations || []).map((location, index) => (
                <div key={location.id} className="translation-card" data-testid={`site-editor-map-location-card-${index + 1}`}>
                  <input
                    value={location.title || ""}
                    placeholder="Название точки"
                    onChange={(event) =>
                      setSiteDraft((prev) => ({
                        ...prev,
                        map_locations: (prev.map_locations || []).map((item) =>
                          item.id === location.id ? { ...item, title: event.target.value } : item
                        ),
                      }))
                    }
                    data-testid={`site-editor-map-location-title-${index + 1}`}
                  />
                  <input
                    value={location.address || ""}
                    placeholder="Адрес"
                    onChange={(event) =>
                      setSiteDraft((prev) => ({
                        ...prev,
                        map_locations: (prev.map_locations || []).map((item) =>
                          item.id === location.id ? { ...item, address: event.target.value } : item
                        ),
                      }))
                    }
                    data-testid={`site-editor-map-location-address-${index + 1}`}
                  />
                  <div className="inline-form compact">
                    <input
                      type="number"
                      step="0.000001"
                      value={location.lat}
                      onChange={(event) =>
                        setSiteDraft((prev) => ({
                          ...prev,
                          map_locations: (prev.map_locations || []).map((item) =>
                            item.id === location.id ? { ...item, lat: Number(event.target.value) } : item
                          ),
                        }))
                      }
                      data-testid={`site-editor-map-location-lat-${index + 1}`}
                    />
                    <input
                      type="number"
                      step="0.000001"
                      value={location.lng}
                      onChange={(event) =>
                        setSiteDraft((prev) => ({
                          ...prev,
                          map_locations: (prev.map_locations || []).map((item) =>
                            item.id === location.id ? { ...item, lng: Number(event.target.value) } : item
                          ),
                        }))
                      }
                      data-testid={`site-editor-map-location-lng-${index + 1}`}
                    />
                  </div>
                  <button
                    className="danger-btn"
                    onClick={() => removeMapLocation(location.id)}
                    data-testid={`site-editor-map-location-delete-${index + 1}`}
                  >
                    Удалить точку
                  </button>
                </div>
              ))}
            </div>

            <button className="primary-btn" onClick={saveSiteSettings} data-testid="site-editor-save-button">
              Сохранить изменения сайта
            </button>
          </section>
        )}

        {activeTab === "leads" && (
          <section className="card" data-testid="leads-tab-content">
            <h2 data-testid="leads-title">Заявки с сайта</h2>

            <div className="inline-form" data-testid="leads-controls-row">
              <input
                placeholder="Поиск по имени или телефону"
                value={leadSearchQuery}
                onChange={(event) => setLeadSearchQuery(event.target.value)}
                data-testid="leads-search-input"
              />
              <select
                value={leadStatusFilter}
                onChange={(event) => setLeadStatusFilter(event.target.value)}
                data-testid="leads-status-filter-select"
              >
                <option value="all">Все статусы</option>
                <option value="pending">Ожидают</option>
                <option value="approved">Подтверждены</option>
                <option value="rejected">Отклонены</option>
              </select>
              <button className="danger-btn" onClick={deleteSelectedLeads} data-testid="leads-delete-selected-button">
                Удалить выбранные
              </button>
              <button
                className="danger-btn"
                onClick={() => openConfirmDialog("Очистка заявок", "Удалить все заявки текущего филиала?", deleteAllLeads)}
                data-testid="leads-delete-all-button"
              >
                Очистить всё
              </button>
            </div>

            <div className="table-like" data-testid="leads-table">
              {filteredLeads.map((lead) => (
                <div key={lead.id} className="row" data-testid={`lead-row-${lead.id}`}>
                  <label className="checkbox-label" data-testid={`lead-checkbox-wrap-${lead.id}`}>
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(lead.id)}
                      onChange={() => toggleLeadSelection(lead.id)}
                      data-testid={`lead-checkbox-${lead.id}`}
                    />
                    Выбрать
                  </label>
                  <div data-testid={`lead-name-${lead.id}`}>{lead.full_name}</div>
                  <div data-testid={`lead-phone-${lead.id}`}>{lead.phone}</div>
                  <div data-testid={`lead-status-${lead.id}`}>{lead.status}</div>
                  {lead.status === "pending" ? (
                    <div className="inline-form compact" data-testid={`lead-actions-${lead.id}`}>
                      <button className="primary-btn" onClick={() => approveLead(lead.id)} data-testid={`lead-approve-button-${lead.id}`}>
                        Подтвердить
                      </button>
                      <button className="danger-btn" onClick={() => rejectLead(lead.id)} data-testid={`lead-reject-button-${lead.id}`}>
                        Отклонить
                      </button>
                    </div>
                  ) : lead.status === "approved" ? (
                    <span data-testid={`lead-approved-mark-${lead.id}`}>Подтверждено</span>
                  ) : (
                    <span data-testid={`lead-rejected-mark-${lead.id}`}>Отклонено</span>
                  )}
                </div>
              ))}
              {filteredLeads.length === 0 && <div data-testid="leads-empty-state">Заявки не найдены</div>}
            </div>
          </section>
        )}

        {activeTab === "students" && (
          <section className="card" data-testid="students-tab-content">
            <h2 data-testid="students-title">Ученики и авторизация</h2>
            <div className="table-like" data-testid="students-table">
              {students.map((student) => (
                <div key={student.id} className="row student-row" data-testid={`student-row-${student.id}`}>
                  <div>
                    <strong data-testid={`student-name-${student.id}`}>{student.full_name}</strong>
                    <p data-testid={`student-phone-${student.id}`}>{student.phone}</p>
                    <small data-testid={`student-groups-${student.id}`}>{student.groups?.join(", ") || "Без группы"}</small>
                  </div>

                  <div className="inline-form compact">
                    <input
                      placeholder="Новый логин"
                      value={credentialsDraft[student.id]?.username || ""}
                      onChange={(event) =>
                        setCredentialsDraft((prev) => ({
                          ...prev,
                          [student.id]: { ...prev[student.id], username: event.target.value },
                        }))
                      }
                      data-testid={`student-username-input-${student.id}`}
                    />
                    <input
                      placeholder="Новый пароль"
                      value={credentialsDraft[student.id]?.password || ""}
                      onChange={(event) =>
                        setCredentialsDraft((prev) => ({
                          ...prev,
                          [student.id]: { ...prev[student.id], password: event.target.value },
                        }))
                      }
                      data-testid={`student-password-input-${student.id}`}
                    />
                    <button
                      className="primary-btn"
                      onClick={() => saveStudentCredentials(student.id)}
                      data-testid={`student-save-credentials-button-${student.id}`}
                    >
                      Сменить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "resources" && (
          <section className="card" data-testid="resources-tab-content">
            <h2 data-testid="resources-title">Преподаватели и классы</h2>

            <div className="split-grid">
              <div className="form-panel" data-testid="teacher-panel">
                <h3 data-testid="teacher-panel-title">Преподаватели</h3>
                <div className="form-grid">
                  <input
                    placeholder="Имя преподавателя"
                    value={teacherForm.name}
                    onChange={(event) => setTeacherForm((prev) => ({ ...prev, name: event.target.value }))}
                    data-testid="teacher-name-input"
                  />
                  <input
                    placeholder="Телефон"
                    value={teacherForm.phone}
                    onChange={(event) => setTeacherForm((prev) => ({ ...prev, phone: event.target.value }))}
                    data-testid="teacher-phone-input"
                  />
                  <input
                    placeholder="Специализация"
                    value={teacherForm.specialization}
                    onChange={(event) => setTeacherForm((prev) => ({ ...prev, specialization: event.target.value }))}
                    data-testid="teacher-specialization-input"
                  />
                  <input
                    placeholder="URL фото"
                    value={teacherForm.image_url}
                    onChange={(event) => setTeacherForm((prev) => ({ ...prev, image_url: event.target.value }))}
                    data-testid="teacher-image-input"
                  />
                  <textarea
                    placeholder="Описание RU"
                    value={teacherForm.bio.ru}
                    onChange={(event) =>
                      setTeacherForm((prev) => ({
                        ...prev,
                        bio: { ...prev.bio, ru: event.target.value },
                      }))
                    }
                    data-testid="teacher-bio-ru-input"
                  />
                  <textarea
                    placeholder="Description EN"
                    value={teacherForm.bio.en}
                    onChange={(event) =>
                      setTeacherForm((prev) => ({
                        ...prev,
                        bio: { ...prev.bio, en: event.target.value },
                      }))
                    }
                    data-testid="teacher-bio-en-input"
                  />
                  <textarea
                    placeholder="Сипаттама KK"
                    value={teacherForm.bio.kk}
                    onChange={(event) =>
                      setTeacherForm((prev) => ({
                        ...prev,
                        bio: { ...prev.bio, kk: event.target.value },
                      }))
                    }
                    data-testid="teacher-bio-kk-input"
                  />
                  <button className="primary-btn" onClick={addTeacher} data-testid="teacher-add-button">
                    Добавить
                  </button>
                </div>

                <div className="simple-list" data-testid="teacher-list">
                  {teachers.map((teacher) => (
                    <div key={teacher.id} className="translation-card" data-testid={`teacher-row-${teacher.id}`}>
                      <input
                        value={teacherDrafts[teacher.id]?.name || ""}
                        onChange={(event) =>
                          setTeacherDrafts((prev) => ({
                            ...prev,
                            [teacher.id]: { ...prev[teacher.id], name: event.target.value },
                          }))
                        }
                        data-testid={`teacher-name-${teacher.id}`}
                      />
                      <input
                        value={teacherDrafts[teacher.id]?.phone || ""}
                        onChange={(event) =>
                          setTeacherDrafts((prev) => ({
                            ...prev,
                            [teacher.id]: { ...prev[teacher.id], phone: event.target.value },
                          }))
                        }
                        data-testid={`teacher-phone-${teacher.id}`}
                      />
                      <input
                        value={teacherDrafts[teacher.id]?.specialization || ""}
                        onChange={(event) =>
                          setTeacherDrafts((prev) => ({
                            ...prev,
                            [teacher.id]: { ...prev[teacher.id], specialization: event.target.value },
                          }))
                        }
                        data-testid={`teacher-specialization-${teacher.id}`}
                      />
                      <input
                        value={teacherDrafts[teacher.id]?.image_url || ""}
                        onChange={(event) =>
                          setTeacherDrafts((prev) => ({
                            ...prev,
                            [teacher.id]: { ...prev[teacher.id], image_url: event.target.value },
                          }))
                        }
                        data-testid={`teacher-image-${teacher.id}`}
                      />
                      {[
                        { code: "ru", label: "RU" },
                        { code: "en", label: "EN" },
                        { code: "kk", label: "KK" },
                      ].map((langItem) => (
                        <textarea
                          key={`${teacher.id}-${langItem.code}`}
                          placeholder={`Bio ${langItem.label}`}
                          value={teacherDrafts[teacher.id]?.bio?.[langItem.code] || ""}
                          onChange={(event) =>
                            setTeacherDrafts((prev) => ({
                              ...prev,
                              [teacher.id]: {
                                ...prev[teacher.id],
                                bio: {
                                  ...prev[teacher.id]?.bio,
                                  [langItem.code]: event.target.value,
                                },
                              },
                            }))
                          }
                          data-testid={`teacher-bio-${teacher.id}-${langItem.code}`}
                        />
                      ))}
                      <div className="inline-form compact">
                        <button className="primary-btn" onClick={() => saveTeacher(teacher.id)} data-testid={`teacher-save-button-${teacher.id}`}>
                          Сохранить
                        </button>
                        <button className="danger-btn" onClick={() => removeTeacher(teacher.id)} data-testid={`teacher-delete-button-${teacher.id}`}>
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-panel" data-testid="classroom-panel">
                <h3 data-testid="classroom-panel-title">Классы</h3>
                <div className="inline-form">
                  <input
                    placeholder="Номер класса"
                    value={classroomForm.name}
                    onChange={(event) => setClassroomForm((prev) => ({ ...prev, name: event.target.value }))}
                    data-testid="classroom-name-input"
                  />
                  <input
                    placeholder="Вместимость"
                    value={classroomForm.capacity}
                    onChange={(event) => setClassroomForm((prev) => ({ ...prev, capacity: event.target.value }))}
                    data-testid="classroom-capacity-input"
                  />
                  <button className="primary-btn" onClick={addClassroom} data-testid="classroom-add-button">
                    Добавить
                  </button>
                </div>

                <div className="simple-list" data-testid="classroom-list">
                  {classrooms.map((item) => (
                    <div key={item.id} className="row" data-testid={`classroom-row-${item.id}`}>
                      <span data-testid={`classroom-name-${item.id}`}>{item.name}</span>
                      <button className="danger-btn" onClick={() => removeClassroom(item.id)} data-testid={`classroom-delete-button-${item.id}`}>
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "groups" && (
          <section className="card" data-testid="groups-tab-content">
            <h2 data-testid="groups-title">Группы, индивидуальные занятия и переводы</h2>

            <div className="form-grid">
              <input
                placeholder="Префикс (например ielts)"
                value={groupForm.prefix}
                onChange={(event) => setGroupForm((prev) => ({ ...prev, prefix: event.target.value }))}
                data-testid="group-prefix-input"
              />
              <input
                type="number"
                placeholder="Номер группы"
                value={groupForm.index}
                onChange={(event) => setGroupForm((prev) => ({ ...prev, index: event.target.value }))}
                data-testid="group-index-input"
              />
              <input
                type="number"
                placeholder="Год"
                value={groupForm.year}
                onChange={(event) => setGroupForm((prev) => ({ ...prev, year: event.target.value }))}
                data-testid="group-year-input"
              />
              <label className="checkbox-label" data-testid="group-individual-toggle-wrapper">
                <input
                  type="checkbox"
                  checked={groupForm.is_individual}
                  onChange={(event) => setGroupForm((prev) => ({ ...prev, is_individual: event.target.checked }))}
                  data-testid="group-individual-toggle"
                />
                Индивидуальная группа
              </label>
              <button className="primary-btn" onClick={addGroup} data-testid="group-create-button">
                Создать группу
              </button>
            </div>

            <div className="simple-list" data-testid="group-list">
              {groups.map((group) => (
                <div key={group.id} className="row" data-testid={`group-row-${group.id}`}>
                  <span data-testid={`group-name-${group.id}`}>
                    {group.name} {group.is_individual ? "(инд.)" : ""}
                  </span>
                  <button
                    className="primary-btn"
                    onClick={() =>
                      openConfirmDialog(
                        "Выпуск группы",
                        "Ученики будут перенесены в выпускники, удалены из активных и их аккаунты будут удалены. Продолжить?",
                        () => graduateGroup(group.id)
                      )
                    }
                    data-testid={`group-graduate-button-${group.id}`}
                  >
                    Выпустить группу
                  </button>
                  <button className="danger-btn" onClick={() => removeGroup(group.id)} data-testid={`group-delete-button-${group.id}`}>
                    Удалить
                  </button>
                </div>
              ))}
            </div>

            <h3 data-testid="group-assign-title">Привязка ученика к группе</h3>
            <div className="inline-form" data-testid="group-assign-form">
              <select
                value={assignForm.student_id}
                onChange={(event) => setAssignForm((prev) => ({ ...prev, student_id: event.target.value }))}
                data-testid="group-assign-student-select"
              >
                <option value="">Выберите ученика</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                  </option>
                ))}
              </select>
              <select
                value={assignForm.group_id}
                onChange={(event) => setAssignForm((prev) => ({ ...prev, group_id: event.target.value }))}
                data-testid="group-assign-group-select"
              >
                <option value="">Выберите группу</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <button className="primary-btn" onClick={assignStudent} data-testid="group-assign-submit-button">
                Добавить в группу
              </button>
            </div>

            <h3 data-testid="group-transfer-title">Перевод между группами</h3>
            <div className="inline-form" data-testid="group-transfer-form">
              <select
                value={transferForm.student_id}
                onChange={(event) => setTransferForm((prev) => ({ ...prev, student_id: event.target.value }))}
                data-testid="group-transfer-student-select"
              >
                <option value="">Ученик</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                  </option>
                ))}
              </select>
              <select
                value={transferForm.from_group_id}
                onChange={(event) => setTransferForm((prev) => ({ ...prev, from_group_id: event.target.value }))}
                data-testid="group-transfer-from-select"
              >
                <option value="">Из группы</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <select
                value={transferForm.to_group_id}
                onChange={(event) => setTransferForm((prev) => ({ ...prev, to_group_id: event.target.value }))}
                data-testid="group-transfer-to-select"
              >
                <option value="">В группу</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <button className="primary-btn" onClick={transferStudent} data-testid="group-transfer-submit-button">
                Перевести
              </button>
            </div>

            <h3 data-testid="groups-students-overview-title">Все ученики и их группы</h3>
            <div className="table-like" data-testid="groups-students-overview-table">
              {students.map((student) => (
                <div key={student.id} className="row" data-testid={`groups-overview-row-${student.id}`}>
                  <span data-testid={`groups-overview-name-${student.id}`}>{student.full_name}</span>
                  <span data-testid={`groups-overview-phone-${student.id}`}>{student.phone}</span>
                  <span data-testid={`groups-overview-groups-${student.id}`}>{student.groups?.join(", ") || "Без группы"}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "graduates" && (
          <section className="card" data-testid="graduates-tab-content">
            <h2 data-testid="graduates-title">Выпускники</h2>
            <div className="inline-form" data-testid="graduates-controls-row">
              <input
                placeholder="Поиск выпускников"
                value={graduateSearchQuery}
                onChange={(event) => setGraduateSearchQuery(event.target.value)}
                data-testid="graduates-search-input"
              />
              <button className="danger-btn" onClick={deleteSelectedGraduates} data-testid="graduates-delete-selected-button">
                Удалить выбранных
              </button>
              <button
                className="danger-btn"
                onClick={() =>
                  openConfirmDialog("Очистка выпускников", "Удалить всех выпускников текущего филиала?", deleteAllGraduates)
                }
                data-testid="graduates-delete-all-button"
              >
                Очистить всё
              </button>
            </div>

            <div className="table-like" data-testid="graduates-table">
              {filteredGraduates.map((graduate) => (
                <div key={graduate.id} className="row" data-testid={`graduate-row-${graduate.id}`}>
                  <label className="checkbox-label" data-testid={`graduate-checkbox-wrap-${graduate.id}`}>
                    <input
                      type="checkbox"
                      checked={selectedGraduateIds.includes(graduate.id)}
                      onChange={() => toggleGraduateSelection(graduate.id)}
                      data-testid={`graduate-checkbox-${graduate.id}`}
                    />
                    Выбрать
                  </label>
                  <span data-testid={`graduate-name-${graduate.id}`}>{graduate.full_name}</span>
                  <span data-testid={`graduate-phone-${graduate.id}`}>{graduate.phone}</span>
                  <span data-testid={`graduate-group-${graduate.id}`}>{graduate.group_name}</span>
                  <span data-testid={`graduate-date-${graduate.id}`}>{graduate.graduated_at?.slice(0, 10)}</span>
                </div>
              ))}
              {filteredGraduates.length === 0 && <div data-testid="graduates-empty-state">Выпускников пока нет</div>}
            </div>
          </section>
        )}

        {activeTab === "schedule" && (
          <section className="card" data-testid="schedule-tab-content">
            <h2 data-testid="schedule-title">Конструктор расписания</h2>

            <div className="form-grid" data-testid="schedule-config-form">
              <label data-testid="schedule-config-start-label">
                Начало занятий
                <input
                  type="time"
                  value={scheduleConfig.start_time}
                  onChange={(event) => setScheduleConfig((prev) => ({ ...prev, start_time: event.target.value }))}
                  data-testid="schedule-config-start-time"
                />
              </label>
              <label data-testid="schedule-config-end-label">
                Конец занятий
                <input
                  type="time"
                  value={scheduleConfig.end_time}
                  onChange={(event) => setScheduleConfig((prev) => ({ ...prev, end_time: event.target.value }))}
                  data-testid="schedule-config-end-time"
                />
              </label>
              <label data-testid="schedule-config-lunch-start-label">
                Обед с
                <input
                  type="time"
                  value={scheduleConfig.lunch_start}
                  onChange={(event) => setScheduleConfig((prev) => ({ ...prev, lunch_start: event.target.value }))}
                  data-testid="schedule-config-lunch-start"
                />
              </label>
              <label data-testid="schedule-config-lunch-end-label">
                Обед до
                <input
                  type="time"
                  value={scheduleConfig.lunch_end}
                  onChange={(event) => setScheduleConfig((prev) => ({ ...prev, lunch_end: event.target.value }))}
                  data-testid="schedule-config-lunch-end"
                />
              </label>
              <label data-testid="schedule-config-lesson-duration-label">
                Длительность урока (мин)
                <input
                  type="number"
                  value={scheduleConfig.lesson_duration}
                  onChange={(event) => setScheduleConfig((prev) => ({ ...prev, lesson_duration: event.target.value }))}
                  data-testid="schedule-config-lesson-duration"
                />
              </label>
              <label data-testid="schedule-config-break-duration-label">
                Перемена (мин, можно 0)
                <input
                  type="number"
                  value={scheduleConfig.break_duration}
                  onChange={(event) => setScheduleConfig((prev) => ({ ...prev, break_duration: event.target.value }))}
                  data-testid="schedule-config-break-duration"
                />
              </label>
            </div>

            <div className="inline-form">
              <button className="primary-btn" onClick={saveScheduleConfig} data-testid="schedule-config-save-button">
                Сохранить настройки
              </button>
            </div>

            <p data-testid="schedule-auto-info-text">Слоты рассчитываются автоматически при изменении настроек времени.</p>

            <div className="simple-list" data-testid="auto-slots-list">
              {autoSlots.map((slot, index) => (
                <div key={`${slot.start}-${slot.end}`} className="row" data-testid={`auto-slot-row-${index + 1}`}>
                  <span data-testid={`auto-slot-label-${index + 1}`}>{slot.label}</span>
                  <span data-testid={`auto-slot-time-${index + 1}`}>
                    {slot.start} - {slot.end}
                  </span>
                  <button
                    className="primary-btn"
                    onClick={() => applyAutoSlot(slot)}
                    data-testid={`auto-slot-apply-${index + 1}`}
                  >
                    Использовать
                  </button>
                </div>
              ))}
            </div>

            <h3 data-testid="schedule-entry-title">Добавить занятие</h3>
            <div className="form-grid" data-testid="schedule-entry-form">
              <select
                value={scheduleForm.day}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, day: event.target.value }))}
                data-testid="schedule-entry-day-select"
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={scheduleForm.start}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, start: event.target.value }))}
                data-testid="schedule-entry-start-input"
              />
              <input
                type="time"
                value={scheduleForm.end}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, end: event.target.value }))}
                data-testid="schedule-entry-end-input"
              />
              <select
                value={scheduleForm.group_id}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, group_id: event.target.value }))}
                data-testid="schedule-entry-group-select"
              >
                <option value="">Группа</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <select
                value={scheduleForm.teacher_id}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, teacher_id: event.target.value }))}
                data-testid="schedule-entry-teacher-select"
              >
                <option value="">Преподаватель</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
              <select
                value={scheduleForm.classroom_id}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, classroom_id: event.target.value }))}
                data-testid="schedule-entry-classroom-select"
              >
                <option value="">Класс</option>
                {classrooms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-form">
              <button className="primary-btn" onClick={createScheduleEntry} data-testid="schedule-save-entry-button">
                {editingScheduleId ? "Обновить занятие" : "Сохранить занятие"}
              </button>
              {editingScheduleId && (
                <button className="danger-btn" onClick={cancelEditSchedule} data-testid="schedule-cancel-edit-button">
                  Отменить редактирование
                </button>
              )}
            </div>

            {conflictState && (
              <div
                className={conflictState.has_conflict ? "conflict-box alert" : "conflict-box"}
                data-testid="schedule-conflict-result-box"
              >
                <strong data-testid="schedule-conflict-status">
                  {conflictState.has_conflict ? "Конфликт найден" : "Конфликтов нет"}
                </strong>
                {conflictState.has_conflict && (
                  <ul data-testid="schedule-conflict-list">
                    {conflictState.conflicts.map((item) => (
                      <li key={item.id} data-testid={`schedule-conflict-item-${item.id}`}>
                        {item.day} {item.start}-{item.end}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="inline-form compact" data-testid="schedule-live-availability-row">
              <div
                className={conflictState?.teacher_busy ? "status-pill status-danger" : "status-pill status-ok"}
                data-testid="schedule-teacher-availability-status"
              >
                Преподаватель: {conflictState?.teacher_busy ? "занят" : "свободен"}
              </div>
              <div
                className={conflictState?.classroom_busy ? "status-pill status-danger" : "status-pill status-ok"}
                data-testid="schedule-classroom-availability-status"
              >
                Класс: {conflictState?.classroom_busy ? "занят" : "свободен"}
              </div>
            </div>

            <div className="table-like" data-testid="schedule-table">
              {schedules.map((item) => (
                <div key={item.id} className="row" data-testid={`schedule-row-${item.id}`}>
                  <span data-testid={`schedule-day-${item.id}`}>{item.day}</span>
                  <span data-testid={`schedule-time-${item.id}`}>
                    {item.start} - {item.end}
                  </span>
                  <span data-testid={`schedule-group-${item.id}`}>{item.group_name}</span>
                  <span data-testid={`schedule-teacher-${item.id}`}>{item.teacher_name}</span>
                  <span data-testid={`schedule-classroom-${item.id}`}>{item.classroom_name}</span>
                  <button className="primary-btn" onClick={() => editSchedule(item)} data-testid={`schedule-edit-button-${item.id}`}>
                    Редактировать
                  </button>
                  <button className="danger-btn" onClick={() => removeSchedule(item.id)} data-testid={`schedule-delete-button-${item.id}`}>
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "account" && (
          <section className="card" data-testid="account-tab-content">
            <h2 data-testid="account-tab-title">Безопасность аккаунта администратора</h2>
            <div className="form-grid" data-testid="admin-credentials-form">
              <label data-testid="admin-credentials-current-password-label">
                Текущий пароль
                <input
                  type="password"
                  value={adminCredentialsForm.current_password}
                  onChange={(event) =>
                    setAdminCredentialsForm((prev) => ({ ...prev, current_password: event.target.value }))
                  }
                  data-testid="admin-credentials-current-password-input"
                />
              </label>
              <label data-testid="admin-credentials-new-username-label">
                Новый логин
                <input
                  value={adminCredentialsForm.new_username}
                  onChange={(event) =>
                    setAdminCredentialsForm((prev) => ({ ...prev, new_username: event.target.value }))
                  }
                  data-testid="admin-credentials-new-username-input"
                />
              </label>
              <label data-testid="admin-credentials-new-password-label">
                Новый пароль
                <input
                  type="password"
                  value={adminCredentialsForm.new_password}
                  onChange={(event) =>
                    setAdminCredentialsForm((prev) => ({ ...prev, new_password: event.target.value }))
                  }
                  data-testid="admin-credentials-new-password-input"
                />
              </label>
            </div>
            <button className="primary-btn" onClick={saveAdminCredentials} data-testid="admin-credentials-save-button">
              Обновить логин и пароль
            </button>
          </section>
        )}
      </main>

      {confirmDialog.open && (
        <div className="confirm-overlay" data-testid="confirm-dialog-overlay">
          <div className="confirm-card" data-testid="confirm-dialog-card">
            <h3 data-testid="confirm-dialog-title">{confirmDialog.title}</h3>
            <p data-testid="confirm-dialog-message">{confirmDialog.message}</p>
            <div className="inline-form compact" data-testid="confirm-dialog-actions">
              <button className="primary-btn" onClick={executeConfirmDialogAction} data-testid="confirm-dialog-approve-button">
                Подтвердить
              </button>
              <button className="danger-btn" onClick={closeConfirmDialog} data-testid="confirm-dialog-cancel-button">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
