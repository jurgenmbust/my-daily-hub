export const spanish = {
  Theme: "Tema",
  System: "Sistema",
  Light: "Claro",
  Dark: "Oscuro",
  "Title is required (maximum 200 characters).":
    "El título es obligatorio (máximo 200 caracteres).",
  "Notes or category exceeds its limit.":
    "Las notas o la categoría superan el límite permitido.",
  "Invalid priority or recurrence.":
    "La prioridad o la repetición no es válida.",
  "Due date must be on or after the start date.":
    "La fecha límite debe ser igual o posterior a la fecha de inicio.",
  "Checklist supports up to 50 nonempty items of 200 characters.":
    "La lista admite hasta 50 pasos de un máximo de 200 caracteres cada uno.",
  "Opening your hub…": "Abriendo tu espacio…",
  "A LITTLE SPACE FOR YOUR DAY": "UN ESPACIO PARA TU DÍA",
  "Make room for what matters.": "Dale espacio a lo que importa.",
  Username: "Nombre de usuario",
  Password: "Contraseña",
  "Sign in →": "Iniciar sesión →",
  "Private by design. Hosted on your network.":
    "Privado por diseño. Alojado en tu red.",
  "YOUR PERSONAL SPACE": "TU ESPACIO PERSONAL",
  Today: "Hoy",
  "All tasks": "Todas las tareas",
  Calendar: "Calendario",
  Settings: "Configuración",
  "Small steps.": "Pequeños pasos.",
  "Meaningful days.": "Días con sentido.",
  "One thing at a time is enough.": "Una cosa a la vez es suficiente.",
  Administrator: "Administrador",
  "Personal workspace": "Espacio personal",
  Exit: "Salir",
  "A fresh start, every day.": "Un nuevo comienzo cada día.",
  "Your plans, at your own pace.": "Tus planes, a tu ritmo.",
  "＋ New task": "＋ Nueva tarea",
  Dismiss: "Cerrar",
  "Today’s progress": "Progreso de hoy",
  "On your list": "En tu lista",
  tasks: "tareas",
  days: "días",
  "Current streak": "Racha actual",
  "A little focus goes a long way": "Un poco de enfoque hace la diferencia",
  "Days with a completed task": "Días con una tarea completada",
  "Today’s focus": "Prioridades de hoy",
  "A little breathing room.": "Un momento para respirar.",
  "Add your first task and give today a direction.":
    "Agrega tu primera tarea y dale rumbo a tu día.",
  "Create a task": "Crear una tarea",
  "Recent activity": "Actividad reciente",
  Task: "Tarea",
  "Your small wins will show up here.": "Tus pequeños logros aparecerán aquí.",
  "“You don’t have to do it all.": "“No tienes que hacerlo todo.",
  "Just the next right thing.”": "Solo el siguiente paso.”",
  "Archive this task? Completion history will be preserved.":
    "¿Archivar esta tarea? Se conservará el historial.",
  "Archive task": "Archivar tarea",
  "Your task list is clear. Add a task to get started.":
    "Tu lista está vacía. Agrega una tarea para comenzar.",
  "← Previous": "← Anterior",
  "Next →": "Siguiente →",
  "Calendar view": "Vista del calendario",
  Month: "Mes",
  Week: "Semana",
  "(archived)": "(archivada)",
  "No tasks scheduled for this date.":
    "No hay tareas programadas para esta fecha.",
  "Sign out": "Cerrar sesión",
  "Your timezone": "Tu zona horaria",
  "Dates and daily boundaries follow your timezone.":
    "Las fechas y el inicio de cada día siguen tu zona horaria.",
  "IANA timezone": "Zona horaria IANA",
  "Save timezone": "Guardar zona horaria",
  "Create a user": "Crear un usuario",
  "New users have their own private tasks and history.":
    "Cada usuario tiene sus propias tareas e historial privados.",
  "User created.": "Usuario creado.",
  "Create user": "Crear usuario",
  "Your day. Your pace.": "Tu día. Tu ritmo.",
  "Edit task": "Editar tarea",
  "A new intention": "Un nuevo propósito",
  Close: "Cerrar",
  "Task title": "Título de la tarea",
  Category: "Categoría",
  Priority: "Prioridad",
  Low: "Baja",
  Medium: "Media",
  High: "Alta",
  "Start date": "Fecha de inicio",
  "Due date / recurrence end": "Fecha límite / fin de repetición",
  Repeat: "Repetir",
  "Does not repeat": "No se repite",
  "Every day": "Todos los días",
  "Every week on start weekday": "Cada semana, el mismo día de inicio",
  "Checklist (one item per line)": "Lista de pasos (uno por línea)",
  Notes: "Notas",
  "Save task": "Guardar tarea",
  "One time": "Una vez",
  daily: "Diaria",
  weekly: "Semanal",
  Edit: "Editar",
  Personal: "Personal",
  Mon: "lun",
  Tue: "mar",
  Wed: "mié",
  Thu: "jue",
  Fri: "vie",
  Sat: "sáb",
  Sun: "dom",
  Language: "Idioma",
  "Complete {title}": "Completar {title}",
  "Edit {title}": "Editar {title}",
  "Due {date}": "Vence el {date}",
  "Welcome back, {name}. Let’s make today count.":
    "Hola de nuevo, {name}. Hagamos que hoy cuente.",
  "{done} of {total} tasks complete": "{done} de {total} tareas completadas",
  "Completed · {date}": "Completada · {date}",
  "{count} planned": "{count} programadas",
  "{date} · Daily activity": "{date} · Actividad del día",
  "Please sign in.": "Inicia sesión.",
  "Request failed ({status})": "La solicitud falló ({status})",
  "Cannot connect to the server. Please try again.":
    "No se pudo conectar con el servidor. Inténtalo de nuevo.",
  "Timezone is required (maximum 100 characters).":
    "La zona horaria es obligatoria (máximo 100 caracteres).",
  "Unknown timezone.": "Zona horaria desconocida.",
  "Username required (80 characters max); password must be 14–256 characters.":
    "El usuario es obligatorio (máximo 80 caracteres); la contraseña debe tener entre 14 y 256 caracteres.",
  "Username already exists.": "Ese nombre de usuario ya existe.",
  "Select at most 367 days.": "Selecciona como máximo 367 días.",
  "Invalid occurrence, future date, or checklist item.":
    "Repetición, fecha futura o paso de la lista no válido.",
  "Missing request protection header.":
    "Falta el encabezado de protección de la solicitud.",
};
/** @typedef {"en" | "es"} Language */
/** @param {string | null | undefined} value @returns {Language | null} */
export function validLanguage(value) {
  return value === "es" || value === "en" ? value : null;
}
/** @param {string} [username] @returns {Language | null} */
export function savedLanguage(username) {
  try {
    return validLanguage(
      localStorage.getItem(
        username ? "hub.language.user." + username : "hub.language",
      ),
    );
  } catch {
    return null;
  }
}
/** @returns {Language} */
export function initialLanguage() {
  return (
    savedLanguage() ||
    (typeof navigator !== "undefined" &&
    navigator.language.toLowerCase().startsWith("es")
      ? "es"
      : "en")
  );
}
/** @param {Language} language @param {string} [username] */
export function saveLanguage(language, username) {
  try {
    localStorage.setItem(
      username ? "hub.language.user." + username : "hub.language",
      language,
    );
  } catch {
    /* Switching still works when browser storage is unavailable. */
  }
}
/** @param {Language} language @param {string} key @param {Record<string, string | number>} [values] */
export function translate(language, key, values = {}) {
  const request = /^Request failed \((\d+)\)$/.exec(key);
  if (request)
    return translate(language, "Request failed ({status})", {
      status: request[1],
    });
  const text = language === "es" ? spanish[key] || key : key;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    String(values[name] ?? match),
  );
}
