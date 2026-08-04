import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import {
  Home, LayoutDashboard, Package, BookOpen, ShoppingCart, Settings,
  Plus, Minus, X, Camera, Check, Trash2, ChevronDown, ChevronRight,
  Martini, Sun, Moon, Search, LogOut, Lock, User as UserIcon, ExternalLink, Copy, GripVertical, Download, Upload, Maximize2,
  Wine, Image as ImageIcon, Pencil
} from "lucide-react";
import { api, getToken, setToken } from "./api.js";

const DashboardTab = React.lazy(() => import("./DashboardTab.jsx"));

const RECIPE_CATS = [
  { id: "aperitivo", label: "Aperitivo" },
  { id: "digestivo", label: "Digestivo" },
  { id: "reconstituyente", label: "Reconstituyente" },
  { id: "refrescante", label: "Refrescante" },
  { id: "favorito", label: "Favorito" },
];

const UNITS = ["unidades", "oz", "ml"];
const DIFFICULTIES = ["Fácil", "Media", "Difícil"];
const ICE_TYPES = ["Cubo estándar", "Pebble", "Esfera", "Crushed", "King Cube", "Spear", "Sin hielo"];
const GLASS_TYPES = [
  "Vaso Cubata", "Vaso Rocks", "Vaso Shot (Chupitos)", "Copa de vino", "Copa Cóctel (Martini)",
  "Vaso Highball", "Vaso Collins", "Copa Champán", "Copa Margarita",
];
const DEFAULT_PAR = { ml: 750, oz: 25, unidades: 12 };
const DEFAULT_STEP = { ml: 50, oz: 0.5, unidades: 1 };
const OZ_TO_ML = 30;

function convertAmount(amount, fromUnit, toUnit) {
  if (fromUnit === toUnit) return amount;
  if (fromUnit === "oz" && toUnit === "ml") return Math.round(amount * OZ_TO_ML);
  if (fromUnit === "ml" && toUnit === "oz") return Math.round((amount / OZ_TO_ML) * 4) / 4;
  return amount; // "unidades" no se convierte con oz/ml
}

const uid = () => Math.random().toString(36).slice(2, 10);

async function resizeImage(file, maxW = 500, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function storageGet(key, fallback) {
  try {
    const r = await api.getData(key);
    return r && r.value !== null && r.value !== undefined ? r.value : fallback;
  } catch (e) {
    return fallback;
  }
}
async function storageSet(key, value) {
  try {
    await api.setData(key, value);
  } catch (e) {
    console.error("storage error", key, e);
  }
}

function FillBar({ value, max, size = "md" }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const h = size === "sm" ? 26 : 40;
  return (
    <div className="fillbar" style={{ height: h }}>
      <div className="fillbar-fill" style={{ height: `${pct * 100}%` }} />
    </div>
  );
}

function Badge({ children, tone = "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Empty({ icon: Icon, title, body }) {
  return (
    <div className="empty">
      <Icon size={28} strokeWidth={1.5} />
      <p className="empty-title">{title}</p>
      <p className="empty-body">{body}</p>
    </div>
  );
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function mdInline(s) {
  return s
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-img" />')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}
function markdownToHtml(md) {
  const lines = escapeHtml(md || "").split(/\r?\n/);
  let html = "";
  let inUl = false, inOl = false;
  function closeLists() {
    if (inUl) { html += "</ul>"; inUl = false; }
    if (inOl) { html += "</ol>"; inOl = false; }
  }
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") { closeLists(); continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { closeLists(); const l = h[1].length + 2; html += `<h${l}>${mdInline(h[2])}</h${l}>`; continue; }
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ol) { if (!inOl) { closeLists(); html += "<ol>"; inOl = true; } html += `<li>${mdInline(ol[1])}</li>`; continue; }
    const ul = line.match(/^[-*•]\s+(.*)$/);
    if (ul) { if (!inUl) { closeLists(); html += "<ul>"; inUl = true; } html += `<li>${mdInline(ul[1])}</li>`; continue; }
    closeLists();
    html += `<p>${mdInline(line)}</p>`;
  }
  closeLists();
  return html;
}
function extractUploadPaths(content) {
  const matches = [...(content || "").matchAll(/!\[[^\]]*\]\((\/uploads\/[^)\s]+)\)/g)];
  return matches.map((m) => m[1]);
}
function Markdown({ text, className }) {
  if (!text || !text.trim()) return null;
  return <div className={`markdown-body ${className || ""}`} dangerouslySetInnerHTML={{ __html: markdownToHtml(text) }} />;
}

function CatPills({ ids, size = "md" }) {
  return (
    <div className={`cat-pills cat-pills-${size}`}>
      {ids.map((id) => {
        const cat = RECIPE_CATS.find((c) => c.id === id);
        return <span key={id} className={`cat-pill cat-${id}`}>{cat ? cat.label : id}</span>;
      })}
    </div>
  );
}

// ---------- Availability logic ----------
function categoryMembersOrdered(categoryId, ingredients, category) {
  const members = ingredients.filter((i) => i.categoryId === categoryId);
  if (!category?.defaultIngredientId) return members;
  const rec = members.find((i) => i.id === category.defaultIngredientId);
  if (!rec) return members;
  return [rec, ...members.filter((i) => i.id !== rec.id)];
}

// Resuelve una referencia de receta (a un ingrediente concreto O a una categoría
// completa) contra el stock actual. Se usa igual tanto para la línea principal
// como para la alternativa, así que una alternativa también puede ser una categoría.
function resolveSlot(ref, ingredients, ingredientsById, categoriesById) {
  if (!ref) return null;
  if (ref.categoryId) {
    const cat = (categoriesById || {})[ref.categoryId];
    const ordered = cat ? categoryMembersOrdered(ref.categoryId, ingredients, cat) : [];
    for (const ing of ordered) {
      const needed = convertAmount(ref.amount, ref.unit, ing.unit);
      if (ing.quantity >= needed) {
        return { ok: true, chosen: ing, needed, isDefault: ing.id === cat.defaultIngredientId || !cat.defaultIngredientId, label: cat.name };
      }
    }
    const primary = ordered[0] || null;
    const needed = primary ? convertAmount(ref.amount, ref.unit, primary.unit) : ref.amount;
    return { ok: false, chosen: primary, needed, have: primary ? primary.quantity : 0, isDefault: true, label: cat ? cat.name : "Categoría eliminada" };
  }
  const ing = ingredientsById[ref.ingredientId];
  const have = ing ? ing.quantity : 0;
  const needed = ing ? convertAmount(ref.amount, ref.unit, ing.unit) : ref.amount;
  const ok = !!ing && have >= needed;
  return { ok, chosen: ing || null, needed, have, isDefault: true, label: ing ? ing.name : "Ingrediente eliminado" };
}

function recipeAvailability(recipe, ingredients, ingredientsById, categoriesById) {
  let missing = [];
  let usedAlt = false;
  for (const ri of recipe.mainIngredients) {
    const primary = resolveSlot(ri, ingredients, ingredientsById, categoriesById);
    if (primary.ok) {
      if (ri.categoryId && !primary.isDefault) usedAlt = true;
      continue;
    }
    if (ri.alt) {
      const altRes = resolveSlot(ri.alt, ingredients, ingredientsById, categoriesById);
      if (altRes.ok) { usedAlt = true; continue; }
    }
    missing.push({
      ...ri, have: primary.have || 0, need: +(primary.needed - (primary.have || 0)).toFixed(2),
      name: primary.label, unit: primary.chosen ? primary.chosen.unit : ri.unit,
    });
  }
  return { available: missing.length === 0, missing, usedAlt: missing.length === 0 && usedAlt };
}

const eurFormat = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function recipeCost(recipe, ingredients, ingredientsById, categoriesById) {
  let total = 0;
  let counted = 0;
  let missingPrice = false;
  recipe.mainIngredients.forEach((mi) => {
    let res = resolveSlot(mi, ingredients, ingredientsById, categoriesById);
    let ing = res.chosen;
    if (!res.ok && mi.alt) {
      const altRes = resolveSlot(mi.alt, ingredients, ingredientsById, categoriesById);
      if (altRes.chosen) ing = altRes.chosen;
    }
    if (!ing || ing.price == null || !ing.parLevel) { missingPrice = true; return; }
    const amt = convertAmount(mi.amount, mi.unit, ing.unit);
    total += amt * (ing.price / ing.parLevel);
    counted++;
  });
  return { total, hasPrice: counted > 0, complete: counted > 0 && !missingPrice };
}

// ================= AUTH =================
function AuthGate({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);

  useEffect(() => {
    api.config().then((c) => setRegistrationEnabled(c.registrationEnabled)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!registrationEnabled && mode === "register") setMode("login");
  }, [registrationEnabled, mode]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    const u = username.trim().toLowerCase();
    if (!u || !password) { setError("Rellena usuario y contraseña."); return; }
    if (mode === "register" && password !== password2) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true);
    try {
      const result = mode === "register" ? await api.register(u, password) : await api.login(u, password);
      setToken(result.token);
      onLogin(result.username);
    } catch (err) {
      setError(err.message || "Algo ha fallado. Prueba otra vez.");
    }
    setBusy(false);
  }

  return (
    <div className="app theme-dark auth-app">
      <Styles />
      <div className="auth-screen">
        <div className="auth-brand"><Martini size={26} strokeWidth={1.5} /><span>Cocktailbrary</span></div>
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={mode === "login" ? "auth-tab-active" : ""} onClick={() => { setMode("login"); setError(""); }}>Entrar</button>
            {registrationEnabled && (
              <button className={mode === "register" ? "auth-tab-active" : ""} onClick={() => { setMode("register"); setError(""); }}>Crear cuenta</button>
            )}
          </div>
          <form className="form" onSubmit={submit}>
            <Field label="Usuario">
              <div className="input-icon"><UserIcon size={15} /><input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="bartender_ana" /></div>
            </Field>
            <Field label="Contraseña">
              <div className="input-icon"><Lock size={15} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></div>
            </Field>
            {mode === "register" && (
              <Field label="Repite la contraseña">
                <div className="input-icon"><Lock size={15} /><input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" /></div>
              </Field>
            )}
            {error && <p className="auth-error">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">
              {mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ================= ROOT =================
export default function Root() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const me = await api.me();
          setUser(me.username);
        } catch (e) {
          setToken(null);
        }
      }
      setChecking(false);
    })();
  }, []);

  function handleLogout() {
    setToken(null);
    setUser(null);
  }

  if (checking) {
    return (
      <div className="app theme-dark auth-app">
        <Styles />
        <p style={{ color: "var(--text-dim)" }}>Comprobando sesión…</p>
      </div>
    );
  }

  if (!user) return <AuthGate onLogin={setUser} />;
  return <CocktailApp username={user} onLogout={handleLogout} />;
}

// ================= APP =================
function CocktailApp({ username, onLogout }) {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("home");
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [settings, setSettings] = useState({ theme: "dark", barName: "Mi barra" });
  const [manualEntries, setManualEntries] = useState([]);
  const [categories, setCategories] = useState([]);

  const [showIngForm, setShowIngForm] = useState(false);
  const [editingIng, setEditingIng] = useState(null);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [viewingRecipe, setViewingRecipe] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [ingSearch, setIngSearch] = useState("");
  const [homeCatFilter, setHomeCatFilter] = useState("all");
  const [toast, setToast] = useState(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingManual, setEditingManual] = useState(null);
  const [viewingManual, setViewingManual] = useState(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  useEffect(() => {
    (async () => {
      const [i, r, s, st, m, c] = await Promise.all([
        storageGet("ingredients", []),
        storageGet("recipes", []),
        storageGet("shoppingList", []),
        storageGet("settings", { theme: "dark", barName: "Mi barra" }),
        storageGet("manual", []),
        storageGet("categories", []),
      ]);
      setIngredients(i);
      setRecipes(r);
      setShoppingList(s);
      setSettings(st);
      setManualEntries(m);
      setCategories(c);
      setLoaded(true);
    })();
  }, [username]);

  useEffect(() => { if (loaded) storageSet("ingredients", ingredients); }, [ingredients, loaded]);
  useEffect(() => { if (loaded) storageSet("recipes", recipes); }, [recipes, loaded]);
  useEffect(() => { if (loaded) storageSet("shoppingList", shoppingList); }, [shoppingList, loaded]);
  useEffect(() => { if (loaded) storageSet("settings", settings); }, [settings, loaded]);
  useEffect(() => { if (loaded) storageSet("manual", manualEntries); }, [manualEntries, loaded]);
  useEffect(() => { if (loaded) storageSet("categories", categories); }, [categories, loaded]);

  const toastTimerRef = useRef(null);
  function showToast(message, action) {
    setToast({ message, action });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), action ? 5000 : 2200);
  }

  const ingredientsById = useMemo(() => {
    const m = {};
    ingredients.forEach((i) => (m[i.id] = i));
    return m;
  }, [ingredients]);

  const categoriesById = useMemo(() => {
    const m = {};
    categories.forEach((c) => (m[c.id] = c));
    return m;
  }, [categories]);

  const recipesWithAvailability = useMemo(
    () => recipes.map((r) => ({
      ...r,
      ...recipeAvailability(r, ingredients, ingredientsById, categoriesById),
      cost: recipeCost(r, ingredients, ingredientsById, categoriesById),
    })),
    [recipes, ingredients, ingredientsById, categoriesById]
  );

  const availableRecipes = recipesWithAvailability.filter((r) => r.available);
  const archivedRecipes = recipesWithAvailability.filter((r) => !r.available);

  function updateIngredientQty(id, delta) {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(0, +(i.quantity + delta).toFixed(2)) } : i)));
  }
  function setIngredientQty(id, value) {
    const v = Math.max(0, parseFloat(value) || 0);
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: v } : i)));
  }
  function reorderIngredients(dragId, overId) {
    if (dragId === overId) return;
    setIngredients((prev) => {
      const dragIdx = prev.findIndex((i) => i.id === dragId);
      const overIdx = prev.findIndex((i) => i.id === overId);
      if (dragIdx === -1 || overIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(overIdx, 0, moved);
      return next;
    });
  }
  function saveCategory(data) {
    if (data.id) setCategories((prev) => prev.map((c) => (c.id === data.id ? { ...c, ...data } : c)));
    else setCategories((prev) => [...prev, { ...data, id: uid(), defaultIngredientId: null }]);
    setShowCategoryForm(false);
  }
  function deleteCategory(id) {
    const cat = categoriesById[id];
    if (!window.confirm(`¿Eliminar la categoría "${cat ? cat.name : ""}"? Los productos que contiene no se borran, simplemente dejan de estar agrupados.`)) return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setIngredients((prev) => prev.map((i) => (i.categoryId === id ? { ...i, categoryId: null } : i)));
    showToast("Categoría eliminada");
  }
  function reorderCategories(dragId, overId) {
    if (dragId === overId) return;
    setCategories((prev) => {
      const dragIdx = prev.findIndex((c) => c.id === dragId);
      const overIdx = prev.findIndex((c) => c.id === overId);
      if (dragIdx === -1 || overIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(overIdx, 0, moved);
      return next;
    });
  }
  function setCategoryDefault(categoryId, ingredientId) {
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, defaultIngredientId: ingredientId } : c)));
  }
  function saveManualEntry(data) {
    if (data.id) setManualEntries((prev) => prev.map((e) => (e.id === data.id ? { ...e, ...data } : e)));
    else setManualEntries((prev) => [...prev, { ...data, id: uid() }]);
    setShowManualForm(false);
    setEditingManual(null);
  }
  function deleteManualEntry(id) {
    const entry = manualEntries.find((e) => e.id === id);
    if (!window.confirm(`¿Eliminar "${entry ? entry.title : "este apunte"}"? No se puede deshacer.`)) return;
    setManualEntries((prev) => prev.filter((e) => e.id !== id));
    setViewingManual(null);
    if (entry) {
      const paths = extractUploadPaths(entry.content);
      if (paths.length) api.deleteImages(paths).catch(() => {});
    }
    showToast("Apunte eliminado");
  }
  function reorderManualEntries(dragId, overId) {
    if (dragId === overId) return;
    setManualEntries((prev) => {
      const dragIdx = prev.findIndex((e) => e.id === dragId);
      const overIdx = prev.findIndex((e) => e.id === overId);
      if (dragIdx === -1 || overIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(overIdx, 0, moved);
      return next;
    });
  }
  function deleteIngredient(id) {
    const ing = ingredients.find((i) => i.id === id);
    if (!window.confirm(`¿Eliminar "${ing ? ing.name : "este ingrediente"}"? No se puede deshacer.`)) return;
    setIngredients((prev) => prev.filter((i) => i.id !== id));
    showToast("Ingrediente eliminado");
  }
  function saveIngredient(data) {
    if (data.id) setIngredients((prev) => prev.map((i) => (i.id === data.id ? data : i)));
    else setIngredients((prev) => [...prev, { ...data, id: uid() }]);
    setShowIngForm(false);
    setEditingIng(null);
  }
  function findOrCreateIngredient(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return null;
    const existing = ingredients.find((i) => i.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const newIng = { id: uid(), name: trimmed, unit: "ml", quantity: 0, parLevel: DEFAULT_PAR.ml, step: DEFAULT_STEP.ml, photo: null, links: [], notes: "" };
    setIngredients((prev) => [...prev, newIng]);
    showToast(`"${trimmed}" creado en el inventario con cantidad 0`);
    return newIng;
  }

  function exportData() {
    const payload = {
      app: "Cocktailbrary", version: 1, exportedAt: new Date().toISOString(), username,
      ingredients, recipes, shoppingList, settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cocktailbrary-${username}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Datos exportados");
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch (e) {
        showToast("El archivo no es un JSON válido");
        return;
      }
      if (!data || typeof data !== "object") { showToast("El archivo no tiene el formato esperado"); return; }
      if (!window.confirm("Esto reemplazará tu inventario, recetas y lista de la compra actuales por los del archivo. ¿Continuar?")) return;
      setIngredients(Array.isArray(data.ingredients) ? data.ingredients : []);
      setRecipes(Array.isArray(data.recipes) ? data.recipes : []);
      setShoppingList(Array.isArray(data.shoppingList) ? data.shoppingList : []);
      if (data.settings && typeof data.settings === "object") setSettings((s) => ({ ...s, ...data.settings }));
      showToast("Datos importados correctamente");
    };
    reader.onerror = () => showToast("No se ha podido leer el archivo");
    reader.readAsText(file);
  }

  async function changePassword(currentPassword, newPassword) {
    await api.changePassword(currentPassword, newPassword);
  }

  function saveRecipe(data) {
    if (data.id) setRecipes((prev) => prev.map((r) => (r.id === data.id ? data : r)));
    else setRecipes((prev) => [...prev, { ...data, id: uid(), timesMade: 0 }]);
    setShowRecipeForm(false);
    setEditingRecipe(null);
  }
  function cloneRecipe(recipe) {
    const { id, timesMade, available, missing, usedAlt, ...rest } = recipe;
    setEditingRecipe({ ...rest, name: `${recipe.name} (copia)` });
    setViewingRecipe(null);
    setShowRecipeForm(true);
  }
  function deleteRecipe(id) {
    const r = recipes.find((x) => x.id === id);
    if (!window.confirm(`¿Eliminar "${r ? r.name : "esta receta"}"? No se puede deshacer.`)) return;
    setRecipes((prev) => prev.filter((x) => x.id !== id));
    setViewingRecipe(null);
    showToast("Receta eliminada");
  }

  function addItemsToShoppingList(items, sourceLabel) {
    setShoppingList((prev) => {
      const next = [...prev];
      items.forEach((m) => {
        const exists = m.ingredientId && next.find((x) => x.ingredientId === m.ingredientId && !x.checked);
        if (exists) exists.amount = Math.max(exists.amount, m.amount);
        else next.push({ id: uid(), ingredientId: m.ingredientId, name: m.name, amount: Math.ceil(m.amount), unit: m.unit, checked: false, fromRecipe: sourceLabel || null });
      });
      return next;
    });
    showToast(sourceLabel ? `Ingredientes de "${sourceLabel}" añadidos a la compra` : `${items[0]?.name || "Ingrediente"} añadido a la compra`);
  }
  function addMissingToShoppingList(recipe, missing) {
    addItemsToShoppingList(missing.map((m) => ({ ingredientId: m.categoryId ? null : m.ingredientId, name: m.name, amount: m.need, unit: m.unit })), recipe.name);
  }
  function addAllRecipeIngredientsToShoppingList(recipe) {
    addItemsToShoppingList(recipe.mainIngredients.map((mi) => {
      const r = resolveSlot(mi, ingredients, ingredientsById, categoriesById);
      return { ingredientId: r.chosen ? r.chosen.id : null, name: r.label, amount: mi.amount, unit: mi.unit };
    }), recipe.name);
  }
  function addIngredientToShoppingList(ing) {
    addItemsToShoppingList([{ ingredientId: ing.id, name: ing.name, amount: Math.max(0.01, ing.step || 1), unit: ing.unit }]);
  }
  function addSuggestionToShoppingList(suggestion) {
    addItemsToShoppingList([{ ingredientId: suggestion.ingredientId, name: suggestion.name, amount: suggestion.need, unit: suggestion.unit }]);
  }

  function markRecipeMade(recipe) {
    const consumptions = [];
    recipe.mainIngredients.forEach((mi) => {
      const primary = resolveSlot(mi, ingredients, ingredientsById, categoriesById);
      if (primary.ok) {
        consumptions.push({ ingredientId: primary.chosen.id, amount: primary.needed });
        return;
      }
      if (mi.alt) {
        const altRes = resolveSlot(mi.alt, ingredients, ingredientsById, categoriesById);
        if (altRes.ok) { consumptions.push({ ingredientId: altRes.chosen.id, amount: altRes.needed }); return; }
      }
      // ni el principal ni la alternativa llegan: se descuenta el principal (clamado a 0)
      if (primary.chosen) consumptions.push({ ingredientId: primary.chosen.id, amount: primary.needed });
    });
    setIngredients((prev) => prev.map((ing) => {
      const total = consumptions.filter((c) => c.ingredientId === ing.id).reduce((sum, c) => sum + c.amount, 0);
      if (total > 0) return { ...ing, quantity: Math.max(0, +(ing.quantity - total).toFixed(2)) };
      return ing;
    }));
    setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? { ...r, timesMade: (r.timesMade || 0) + 1 } : r)));
    showToast(`${recipe.name} servido`, {
      label: "Deshacer",
      onClick: () => {
        setIngredients((prev) => prev.map((ing) => {
          const total = consumptions.filter((c) => c.ingredientId === ing.id).reduce((sum, c) => sum + c.amount, 0);
          if (total > 0) return { ...ing, quantity: +(ing.quantity + total).toFixed(2) };
          return ing;
        }));
        setRecipes((prev) => prev.map((r) => (r.id === recipe.id ? { ...r, timesMade: Math.max(0, (r.timesMade || 0) - 1) } : r)));
        showToast("Deshecho: inventario y contador restaurados");
      },
    });
  }

  function toggleShoppingItem(id) {
    const item = shoppingList.find((s) => s.id === id);
    if (!item) return;
    const willBeChecked = !item.checked;
    if (willBeChecked && item.ingredientId) {
      const ing = ingredientsById[item.ingredientId];
      if (ing) {
        const amt = convertAmount(item.amount, item.unit, ing.unit);
        setIngredients((prev) => prev.map((i) => (i.id === ing.id ? { ...i, quantity: +(i.quantity + amt).toFixed(2) } : i)));
        showToast(`+${amt} ${ing.unit} de ${ing.name} añadidos al inventario`);
      }
    }
    setShoppingList((prev) => prev.map((s) => (s.id === id ? { ...s, checked: willBeChecked } : s)));
  }
  function removeShoppingItem(id) { setShoppingList((prev) => prev.filter((s) => s.id !== id)); }
  function clearChecked() { setShoppingList((prev) => prev.filter((s) => !s.checked)); }
  function addManualShoppingItem(name, amount, unit) {
    if (!name.trim()) return;
    const amt = Math.max(0.01, parseFloat(amount) || 1);
    setShoppingList((prev) => [...prev, { id: uid(), ingredientId: null, name, amount: amt, unit: unit || "unidades", checked: false, fromRecipe: null }]);
  }

  if (!loaded) {
    return (
      <div className="app theme-dark" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
        <Styles />
        <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>Preparando la barra…</p>
      </div>
    );
  }

  return (
    <div className={`app theme-${settings.theme}`}>
      <Styles />
      {toast && (
        <div className="toast">
          <span>{toast.message}</span>
          {toast.action && (
            <button className="toast-action" onClick={() => { toast.action.onClick(); setToast(null); }}>{toast.action.label}</button>
          )}
        </div>
      )}

      <nav className="sidebar">
        <div className="brand"><Martini size={22} strokeWidth={1.6} /><span>{settings.barName}</span></div>
        <NavButton icon={Home} label="Home" active={tab === "home"} onClick={() => setTab("home")} />
        <NavButton icon={Package} label="Inventario" active={tab === "inventario"} onClick={() => setTab("inventario")} />
        <NavButton icon={Wine} label="Recetas" active={tab === "recetas"} onClick={() => setTab("recetas")} />
        <NavButton icon={ShoppingCart} label="Compra" active={tab === "compra"} badge={shoppingList.filter((s) => !s.checked).length} onClick={() => setTab("compra")} />
        <NavButton icon={LayoutDashboard} label="Métricas" active={tab === "dashboard"} onClick={() => setTab("dashboard")} />
        <NavButton icon={BookOpen} label="Manual" active={tab === "manual"} onClick={() => setTab("manual")} />
        <NavButton icon={Settings} label="Ajustes" active={tab === "ajustes"} onClick={() => setTab("ajustes")} />
        <div style={{ flex: 1 }} />
        <div className="sidebar-user">
          <span className="sidebar-username">{username}</span>
          <button className="icon-btn" onClick={onLogout} title="Cerrar sesión"><LogOut size={15} /></button>
        </div>
      </nav>

      <main className="main">
        {tab === "home" && (
          <HomeTab
            available={availableRecipes}
            archived={archivedRecipes}
            showArchived={showArchived}
            setShowArchived={setShowArchived}
            catFilter={homeCatFilter}
            setCatFilter={setHomeCatFilter}
            onMake={markRecipeMade}
            onAddMissing={addMissingToShoppingList}
            onAddAll={addAllRecipeIngredientsToShoppingList}
            onView={setViewingRecipe}
          />
        )}
        {tab === "dashboard" && (
          <Suspense fallback={<p className="page-sub">Cargando métricas…</p>}>
            <DashboardTab recipes={recipes} ingredients={ingredients} availableCount={availableRecipes.length} />
          </Suspense>
        )}
        {tab === "inventario" && (
          <InventarioTab
            ingredients={ingredients}
            categories={categories}
            search={ingSearch}
            setSearch={setIngSearch}
            onAdjust={updateIngredientQty}
            onSet={setIngredientQty}
            onEdit={(ing) => { setEditingIng(ing); setShowIngForm(true); }}
            onDelete={deleteIngredient}
            onNew={(categoryId) => { setEditingIng(categoryId ? { categoryId, unit: categoriesById[categoryId]?.unit || "ml" } : null); setShowIngForm(true); }}
            onAddToShopping={addIngredientToShoppingList}
            onReorder={reorderIngredients}
            onNewCategory={() => { setEditingCategory(null); setShowCategoryForm(true); }}
            onEditCategory={(cat) => { setEditingCategory(cat); setShowCategoryForm(true); }}
            onDeleteCategory={deleteCategory}
            onReorderCategories={reorderCategories}
            onSetDefault={setCategoryDefault}
          />
        )}
        {tab === "recetas" && (
          <RecetasTab
            recipes={recipesWithAvailability}
            search={recipeSearch}
            setSearch={setRecipeSearch}
            onNew={() => { setEditingRecipe(null); setShowRecipeForm(true); }}
            onView={setViewingRecipe}
            onAddToShopping={addAllRecipeIngredientsToShoppingList}
            onMake={markRecipeMade}
          />
        )}
        {tab === "compra" && (
          <CompraTab items={shoppingList} archivedRecipes={archivedRecipes} onToggle={toggleShoppingItem} onRemove={removeShoppingItem} onClear={clearChecked} onAdd={addManualShoppingItem} onAddSuggestion={addSuggestionToShoppingList} />
        )}
        {tab === "manual" && (
          <ManualTab
            entries={manualEntries}
            onNew={() => { setEditingManual(null); setShowManualForm(true); }}
            onEdit={(entry) => { setEditingManual(entry); setShowManualForm(true); }}
            onDelete={deleteManualEntry}
            onReorder={reorderManualEntries}
            onView={setViewingManual}
          />
        )}
        {tab === "ajustes" && <AjustesTab settings={settings} setSettings={setSettings} counts={{ ingredients: ingredients.length, recipes: recipes.length }} username={username} onExport={exportData} onImport={importData} onChangePassword={changePassword} />}
      </main>

      {showManualForm && (
        <ManualEntryForm initial={editingManual} onCancel={() => { setShowManualForm(false); setEditingManual(null); }} onSave={saveManualEntry} />
      )}
      {viewingManual && (
        <ManualEntryDetail
          entry={manualEntries.find((e) => e.id === viewingManual.id) || viewingManual}
          onClose={() => setViewingManual(null)}
          onEdit={() => { setEditingManual(viewingManual); setViewingManual(null); setShowManualForm(true); }}
          onDelete={() => deleteManualEntry(viewingManual.id)}
        />
      )}

      {showIngForm && (
        <IngredientForm initial={editingIng} recipes={recipes} categories={categories} onCancel={() => { setShowIngForm(false); setEditingIng(null); }} onSave={saveIngredient} />
      )}
      {showCategoryForm && (
        <CategoryForm
          initial={editingCategory}
          hasMembers={editingCategory ? ingredients.some((i) => i.categoryId === editingCategory.id) : false}
          onCancel={() => { setShowCategoryForm(false); setEditingCategory(null); }}
          onSave={(data) => { saveCategory(data); setEditingCategory(null); }}
        />
      )}
      {showRecipeForm && (
        <RecipeForm initial={editingRecipe} ingredients={ingredients} ingredientCategories={categories} onCancel={() => { setShowRecipeForm(false); setEditingRecipe(null); }} onSave={saveRecipe} onCreateIngredient={findOrCreateIngredient} />
      )}
      {viewingRecipe && (
        <RecipeDetail
          recipe={recipesWithAvailability.find((r) => r.id === viewingRecipe.id) || viewingRecipe}
          ingredients={ingredients}
          ingredientsById={ingredientsById}
          categoriesById={categoriesById}
          onClose={() => setViewingRecipe(null)}
          onEdit={() => { setEditingRecipe(viewingRecipe); setViewingRecipe(null); setShowRecipeForm(true); }}
          onDelete={() => deleteRecipe(viewingRecipe.id)}
          onMake={markRecipeMade}
          onAddMissing={addMissingToShoppingList}
          onAddAll={addAllRecipeIngredientsToShoppingList}
          onClone={cloneRecipe}
        />
      )}
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button className={`navbtn ${active ? "navbtn-active" : ""}`} onClick={onClick}>
      <Icon size={19} strokeWidth={1.7} />
      <span className="navbtn-label">{label}</span>
      {!!badge && <span className="navbtn-badge">{badge}</span>}
    </button>
  );
}

// ---------- HOME ----------
function HomeTab({ available, archived, showArchived, setShowArchived, catFilter, setCatFilter, onMake, onAddMissing, onAddAll, onView }) {
  const filterFn = (r) => catFilter === "all" || (r.categories || []).includes(catFilter);
  const availFiltered = available.filter(filterFn);
  const archFiltered = archived.filter(filterFn);
  const sorted = [...availFiltered].sort((a, b) => DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty));

  return (
    <div>
      <header className="page-header">
        <h1>Se puede servir</h1>
        <p className="page-sub">{availFiltered.length} de {availFiltered.length + archFiltered.length} recetas listas con lo que tienes en la barra ahora mismo.</p>
      </header>

      <div className="cat-filter-row">
        <button className={`cat-filter-chip ${catFilter === "all" ? "cat-filter-active" : ""}`} onClick={() => setCatFilter("all")}>Todas</button>
        {[...RECIPE_CATS].sort((a, b) => (a.id === "favorito" ? -1 : b.id === "favorito" ? 1 : 0)).map((c) => (
          <button key={c.id} className={`cat-filter-chip cat-filter-${c.id} ${catFilter === c.id ? "cat-filter-active" : ""}`} onClick={() => setCatFilter(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <Empty icon={Martini} title="Nada listo por aquí" body="Prueba a cambiar el filtro, o añade ingredientes y recetas para ver más opciones." />
      ) : (
        <div className="grid-cards">
          {sorted.map((r) => (
            <div key={r.id} style={{ position: "relative" }}>
              <RecipeCard recipe={r} onClick={() => onView(r)} onMake={() => onMake(r)} onAddToShopping={() => onAddAll(r)} iconActions />
              {r.usedAlt && <span className="substituted-flag">Con sustitución</span>}
            </div>
          ))}
        </div>
      )}

      <button className="collapse-toggle" onClick={() => setShowArchived((s) => !s)}>
        {showArchived ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Faltan ingredientes ({archFiltered.length})
      </button>

      {showArchived && (
        <div className="archived-list">
          {archFiltered.map((r) => (
            <div key={r.id} className="archived-row">
              <div className="archived-info" onClick={() => onView(r)}>
                <span className="archived-name">{r.name}</span>
                <span className="archived-missing">Falta: {r.missing.map((m) => m.name).join(", ")}</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onAddMissing(r, r.missing)}><ShoppingCart size={14} /> Añadir a la compra</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe, onClick, onMake, onAddToShopping, iconActions }) {
  return (
    <div className="recipe-card">
      <div className="recipe-card-photo" onClick={onClick}>
        {recipe.photo ? <img src={recipe.photo} alt={recipe.name} /> : <Martini size={30} strokeWidth={1.3} />}
        <CatPills ids={recipe.categories || []} size="sm" />
      </div>
      <div className="recipe-card-body">
        <h3 onClick={onClick}>{recipe.name}</h3>
        <div className="recipe-card-meta">
          <span>{recipe.time} min</span><span>·</span><span>{recipe.difficulty}</span>
          {recipe.cost?.hasPrice && (<><span>·</span><span>{recipe.cost.complete ? "" : "~"}{eurFormat.format(recipe.cost.total)}</span></>)}
        </div>
        {iconActions ? (
          <div className="card-icon-actions">
            {onAddToShopping && <button className="icon-card-btn" title="Añadir a la compra" onClick={onAddToShopping}><ShoppingCart size={15} /></button>}
            {onMake && <button className="icon-card-btn icon-card-btn-primary" title="Marcar como servido" disabled={!recipe.available} onClick={onMake}><Check size={15} /></button>}
          </div>
        ) : (
          <>
            {onMake && <button className="btn btn-primary btn-sm btn-block" onClick={onMake}><Check size={14} /> Servido</button>}
            {onAddToShopping && <button className="btn btn-ghost btn-sm btn-block" onClick={onAddToShopping}><ShoppingCart size={14} /> Añadir a la compra</button>}
          </>
        )}
      </div>
    </div>
  );
}

// ---------- DASHBOARD ----------
// ---------- INVENTARIO ----------
function IngredientRow({ ing, draggable, isDragging, isOver, dragHandlers, onEdit, onAdjust, onSet, onAddToShopping, onDelete, star }) {
  return (
    <div
      className={`ing-row ${isDragging ? "ing-row-dragging" : ""} ${isOver ? "ing-row-over" : ""}`}
      draggable={draggable}
      {...dragHandlers}
    >
      {draggable && <span className="drag-handle" title="Arrastra para reordenar"><GripVertical size={14} /></span>}
      {star}
      <div className="ing-thumb">{ing.photo ? <img src={ing.photo} alt="" /> : <Package size={16} strokeWidth={1.5} />}</div>
      <FillBar value={ing.quantity} max={ing.parLevel || 750} size="sm" />
      <div className="ing-info" onClick={() => onEdit(ing)}>
        <span className="ing-name">
          {ing.name}
          {ing.lowStockEnabled && ing.quantity <= (ing.lowStockThreshold ?? 0) && (
            <span className="low-stock-tag">Stock bajo</span>
          )}
        </span>
        <span className="ing-unit">{ing.unit}{ing.notes ? ` · ${ing.notes}` : ""}</span>
      </div>
      {ing.links && ing.links.length > 0 && (
        <a className="icon-btn" href={ing.links[0].url} target="_blank" rel="noopener noreferrer" title={ing.links[0].label || ing.links[0].url} onClick={(e) => e.stopPropagation()}>
          <ExternalLink size={15} />
        </a>
      )}
      <button className="icon-btn" title="Añadir a la lista de la compra" onClick={() => onAddToShopping(ing)}><ShoppingCart size={15} /></button>
      <div className="qty-stepper">
        <button onClick={() => onAdjust(ing.id, -(ing.step || 1))}><Minus size={14} /></button>
        <input type="number" min="0" step="any" value={ing.quantity} onChange={(e) => onSet(ing.id, e.target.value)} />
        <button onClick={() => onAdjust(ing.id, ing.step || 1)}><Plus size={14} /></button>
      </div>
      <button className="icon-btn" onClick={() => onDelete(ing.id)}><Trash2 size={15} /></button>
    </div>
  );
}

function InventarioTab({
  ingredients, categories, search, setSearch, onAdjust, onSet, onEdit, onDelete, onNew, onAddToShopping, onReorder,
  onNewCategory, onEditCategory, onDeleteCategory, onReorderCategories, onSetDefault,
}) {
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [dragCatId, setDragCatId] = useState(null);
  const [overCatId, setOverCatId] = useState(null);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const q = search.trim().toLowerCase();
  const isSearching = q.length > 0;

  function toggleCollapsed(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function ingDragHandlers(ing) {
    return {
      onDragStart: () => setDragId(ing.id),
      onDragOver: (e) => { e.preventDefault(); setOverId(ing.id); },
      onDragLeave: () => setOverId((cur) => (cur === ing.id ? null : cur)),
      onDrop: (e) => { e.preventDefault(); if (dragId) onReorder(dragId, ing.id); setDragId(null); setOverId(null); },
      onDragEnd: () => { setDragId(null); setOverId(null); },
    };
  }

  // Al buscar, una categoría se muestra si su propio nombre coincide (en cuyo caso
  // se ven todas sus marcas) o si alguna de sus marcas coincide (solo esas).
  const visibleGroups = categories
    .map((cat) => {
      const allMembers = ingredients.filter((i) => i.categoryId === cat.id);
      if (!isSearching) return { cat, allMembers, visibleMembers: allMembers };
      const catNameMatches = cat.name.toLowerCase().includes(q);
      const matchingMembers = allMembers.filter((i) => i.name.toLowerCase().includes(q));
      if (catNameMatches) return { cat, allMembers, visibleMembers: allMembers };
      if (matchingMembers.length > 0) return { cat, allMembers, visibleMembers: matchingMembers };
      return null;
    })
    .filter(Boolean);

  const ungrouped = ingredients
    .filter((i) => !i.categoryId)
    .filter((i) => !isSearching || i.name.toLowerCase().includes(q));

  const nothingFound = isSearching && visibleGroups.length === 0 && ungrouped.length === 0;

  return (
    <div>
      <header className="page-header page-header-row">
        <div><h1>Inventario</h1><p className="page-sub">{ingredients.length} ingredientes en la barra.</p></div>
        <div className="header-btn-group">
          <button className="btn btn-ghost" onClick={onNewCategory}><Plus size={16} /> Categoría</button>
          <button className="btn btn-primary" onClick={() => onNew()}><Plus size={16} /> Ingrediente</button>
        </div>
      </header>

      <div className="search-box"><Search size={15} /><input placeholder="Buscar ingrediente o categoría…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      {ingredients.length === 0 && categories.length === 0 ? (
        <Empty icon={Package} title="La barra está vacía" body="Crea a mano cada ingrediente la primera vez que lo compres. Luego ajustas cantidades con los botones + y −." />
      ) : nothingFound ? (
        <Empty icon={Search} title="Sin resultados" body="No hay ningún ingrediente ni categoría que coincida con la búsqueda." />
      ) : (
        <>
          {!isSearching && (ingredients.length > 1 || categories.length > 1) && <p className="combo-hint" style={{ marginBottom: 14 }}>Arrastra el icono de la izquierda para reordenar.</p>}

          {visibleGroups.length > 0 && (
            <div className="cat-group-list">
              {visibleGroups.map(({ cat, allMembers, visibleMembers }) => {
                const total = allMembers.reduce((s, i) => s + i.quantity, 0);
                const isOpen = isSearching || !collapsed.has(cat.id);
                return (
                  <div
                    key={cat.id}
                    className={`cat-group ${dragCatId === cat.id ? "ing-row-dragging" : ""} ${overCatId === cat.id && dragCatId && dragCatId !== cat.id ? "ing-row-over" : ""}`}
                    draggable={!isSearching}
                    onDragStart={() => setDragCatId(cat.id)}
                    onDragOver={(e) => { if (!isSearching) { e.preventDefault(); setOverCatId(cat.id); } }}
                    onDragLeave={() => setOverCatId((cur) => (cur === cat.id ? null : cur))}
                    onDrop={(e) => { e.preventDefault(); if (dragCatId) onReorderCategories(dragCatId, cat.id); setDragCatId(null); setOverCatId(null); }}
                    onDragEnd={() => { setDragCatId(null); setOverCatId(null); }}
                  >
                    <div className="cat-group-header">
                      {!isSearching && <span className="drag-handle" title="Arrastra para reordenar"><GripVertical size={14} /></span>}
                      <button className="icon-btn" onClick={() => toggleCollapsed(cat.id)}>{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                      <span className="cat-group-name" onClick={() => toggleCollapsed(cat.id)}>{cat.name}</span>
                      <span className="cat-group-total">{allMembers.length} marca{allMembers.length === 1 ? "" : "s"} · {+total.toFixed(2)} {cat.unit} en total</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => onNew(cat.id)}><Plus size={13} /> Producto</button>
                      <button className="icon-btn" title="Editar categoría" onClick={() => onEditCategory(cat)}><Pencil size={14} /></button>
                      <button className="icon-btn" title="Eliminar categoría" onClick={() => onDeleteCategory(cat.id)}><Trash2 size={15} /></button>
                    </div>
                    {isOpen && (
                      <div className="cat-group-members">
                        {visibleMembers.length === 0 ? (
                          <p className="empty-body" style={{ margin: "4px 0 6px 30px" }}>Sin marcas todavía. Añade la primera con "Producto".</p>
                        ) : visibleMembers.map((ing) => (
                          <IngredientRow
                            key={ing.id}
                            ing={ing}
                            draggable={!isSearching}
                            isDragging={dragId === ing.id}
                            isOver={overId === ing.id && dragId && dragId !== ing.id}
                            dragHandlers={ingDragHandlers(ing)}
                            onEdit={onEdit}
                            onAdjust={onAdjust}
                            onSet={onSet}
                            onAddToShopping={onAddToShopping}
                            onDelete={onDelete}
                            star={
                              <button
                                type="button"
                                className={`star-btn ${cat.defaultIngredientId === ing.id ? "star-btn-active" : ""}`}
                                title={cat.defaultIngredientId === ing.id ? "Recomendada por defecto" : "Marcar como recomendada"}
                                onClick={() => onSetDefault(cat.id, ing.id)}
                              >★</button>
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {ungrouped.length > 0 && (
            <div className="ing-list" style={{ marginTop: visibleGroups.length > 0 ? 18 : 0 }}>
              {ungrouped.map((ing) => (
                <IngredientRow
                  key={ing.id}
                  ing={ing}
                  draggable={!isSearching}
                  isDragging={dragId === ing.id}
                  isOver={overId === ing.id && dragId && dragId !== ing.id}
                  dragHandlers={ingDragHandlers(ing)}
                  onEdit={onEdit}
                  onAdjust={onAdjust}
                  onSet={onSet}
                  onAddToShopping={onAddToShopping}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CategoryForm({ initial, hasMembers, onCancel, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [unit, setUnit] = useState(initial?.unit || "ml");
  return (
    <Modal title={initial ? "Editar categoría" : "Nueva categoría"} onClose={onCancel}>
      <div className="form">
        <Field label="Nombre"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Bourbon" /></Field>
        <Field label="Unidad de todos los productos de esta categoría">
          <select value={unit} onChange={(e) => setUnit(e.target.value)} disabled={hasMembers}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
        </Field>
        {hasMembers ? (
          <p className="combo-hint">La unidad no se puede cambiar porque ya hay productos dentro de esta categoría.</p>
        ) : (
          <p className="combo-hint">Todos los productos que metas dentro compartirán esta unidad, para que la suma total tenga sentido.</p>
        )}
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onSave({ id: initial?.id, name: name.trim(), unit })}>{initial ? "Guardar" : "Crear categoría"}</button>
        </div>
      </div>
    </Modal>
  );
}

function IngredientForm({ initial, recipes, categories, onCancel, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [unit, setUnit] = useState(initial?.unit || "ml");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 0);
  const [parLevel, setParLevel] = useState(initial?.parLevel ?? DEFAULT_PAR[initial?.unit] ?? DEFAULT_PAR.ml);
  const [step, setStep] = useState(initial?.step ?? DEFAULT_STEP[initial?.unit] ?? DEFAULT_STEP.ml);
  const [price, setPrice] = useState(initial?.price ?? "");
  const [photo, setPhoto] = useState(initial?.photo || null);
  const [links, setLinks] = useState(initial?.links || []);
  const [notes, setNotes] = useState(initial?.notes || "");
  const [lowStockEnabled, setLowStockEnabled] = useState(initial?.lowStockEnabled || false);
  const [lowStockThreshold, setLowStockThreshold] = useState(initial?.lowStockThreshold ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId || "");
  const [dragLinkId, setDragLinkId] = useState(null);
  const [overLinkId, setOverLinkId] = useState(null);
  const [showAllUsedIn, setShowAllUsedIn] = useState(false);

  const usedInRecipes = useMemo(() => {
    if (!initial?.id || !recipes) return [];
    return recipes
      .filter((r) => r.mainIngredients.some((mi) => mi.ingredientId === initial.id || mi.alt?.ingredientId === initial.id || (initial.categoryId && mi.categoryId === initial.categoryId)))
      .map((r) => {
        const direct = r.mainIngredients.some((mi) => mi.ingredientId === initial.id);
        const viaCategory = !direct && r.mainIngredients.some((mi) => initial.categoryId && mi.categoryId === initial.categoryId);
        return { id: r.id, name: r.name, asAlt: !direct && !viaCategory, viaCategory };
      });
  }, [recipes, initial]);
  const visibleUsedIn = showAllUsedIn ? usedInRecipes : usedInRecipes.slice(0, 3);

  function handleUnitChange(u) {
    setUnit(u);
    if (!initial) {
      setParLevel(DEFAULT_PAR[u] || 750);
      setStep(DEFAULT_STEP[u] || 1);
    }
  }

  function handleCategoryChange(id) {
    setCategoryId(id);
    const cat = (categories || []).find((c) => c.id === id);
    if (cat) handleUnitChange(cat.unit);
  }

  function addLink() { setLinks((prev) => [...prev, { id: uid(), label: "", url: "" }]); }
  function updateLink(id, field, value) { setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))); }
  function removeLink(id) { setLinks((prev) => prev.filter((l) => l.id !== id)); }
  function reorderLinks(dragId, overId) {
    if (dragId === overId) return;
    setLinks((prev) => {
      const dragIdx = prev.findIndex((l) => l.id === dragId);
      const overIdx = prev.findIndex((l) => l.id === overId);
      if (dragIdx === -1 || overIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(overIdx, 0, moved);
      return next;
    });
  }

  return (
    <Modal title={initial?.id ? "Editar ingrediente" : "Nuevo ingrediente"} onClose={onCancel}>
      <div className="form">
        <PhotoUpload photo={photo} onPhoto={setPhoto} small maxW={300} />

        <Field label="Nombre"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Angostura bitters" /></Field>

        {categories && categories.length > 0 && (
          <Field label="Categoría (opcional, ej. varias marcas de Bourbon)">
            <select value={categoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
              <option value="">Ninguna — producto suelto</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}

        <div className="field-row">
          <Field label="Unidad">
            <select value={unit} onChange={(e) => handleUnitChange(e.target.value)} disabled={!!categoryId}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
          </Field>
          <Field label="Cantidad actual"><input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
        </div>
        <div className="field-row">
          <Field label="Paso +/-"><input type="number" min="0" step="any" value={step} onChange={(e) => setStep(e.target.value)} /></Field>
          <Field label="Botella / envase lleno (referencia)"><input type="number" min="0" step="any" value={parLevel} onChange={(e) => setParLevel(e.target.value)} /></Field>
        </div>
        {categoryId && <p className="combo-hint" style={{ marginTop: -10 }}>La unidad se bloquea a la de la categoría, para que la suma total tenga sentido.</p>}

        <Field label={`Precio de ese envase completo de ${parLevel || 0} ${unit} (opcional, en €)`}>
          <input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ej. 18.50" />
        </Field>

        <Field label="Aviso de stock bajo">
          <label className="checkbox-row">
            <input type="checkbox" checked={lowStockEnabled} onChange={(e) => setLowStockEnabled(e.target.checked)} />
            <span>Avisar cuando quede poco de este ingrediente</span>
          </label>
          {lowStockEnabled && (
            <div className="low-stock-amount">
              <span>Avisar cuando la cantidad sea igual o menor a</span>
              <input type="number" min="0" step="any" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} style={{ width: 80 }} />
              <span>{unit}</span>
            </div>
          )}
        </Field>

        <Field label="Enlaces de compra online (el primero es el del acceso directo en Inventario)">
          <div className="links-list">
            {links.map((l) => (
              <div
                key={l.id}
                className={`link-row ${dragLinkId === l.id ? "link-row-dragging" : ""} ${overLinkId === l.id && dragLinkId && dragLinkId !== l.id ? "link-row-over" : ""}`}
                draggable
                onDragStart={() => setDragLinkId(l.id)}
                onDragOver={(e) => { e.preventDefault(); setOverLinkId(l.id); }}
                onDragLeave={() => setOverLinkId((cur) => (cur === l.id ? null : cur))}
                onDrop={(e) => { e.preventDefault(); if (dragLinkId) reorderLinks(dragLinkId, l.id); setDragLinkId(null); setOverLinkId(null); }}
                onDragEnd={() => { setDragLinkId(null); setOverLinkId(null); }}
              >
                <span className="drag-handle" title="Arrastra para reordenar"><GripVertical size={14} /></span>
                <input value={l.label} onChange={(e) => updateLink(l.id, "label", e.target.value)} placeholder="Nombre (ej. Amazon)" className="link-label-input" />
                <input value={l.url} onChange={(e) => updateLink(l.id, "url", e.target.value)} placeholder="https://…" />
                <a
                  className={`icon-btn ${!l.url.trim() ? "icon-btn-disabled" : ""}`}
                  href={l.url.trim() || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={l.url.trim() ? `Abrir ${l.label || l.url}` : "Añade una URL primero"}
                  onClick={(e) => { if (!l.url.trim()) e.preventDefault(); }}
                >
                  <ExternalLink size={14} />
                </a>
                <button type="button" className="icon-btn" onClick={() => removeLink(l.id)}><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={addLink}><Plus size={14} /> Añadir enlace</button>
          </div>
        </Field>

        <Field label="Notas (ej. producto de venta local, dónde se compra)">
          <textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Se compra en la tienda de la esquina… (admite markdown: listas, **negrita**, etc.)" />
        </Field>

        {usedInRecipes.length > 0 && (
          <Field label={`Se usa en ${usedInRecipes.length} receta${usedInRecipes.length === 1 ? "" : "s"}`}>
            <ul className="used-in-list">
              {visibleUsedIn.map((r) => (
                <li key={r.id}>
                  <span>{r.name}</span>
                  {r.asAlt && <span className="alt-tag">alt.</span>}
                  {r.viaCategory && <span className="alt-tag">vía categoría</span>}
                </li>
              ))}
            </ul>
            {usedInRecipes.length > 3 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAllUsedIn((s) => !s)}>
                {showAllUsedIn ? "Mostrar menos" : `Mostrar más (${usedInRecipes.length - 3})`}
              </button>
            )}
          </Field>
        )}

        <div className="form-actions">
          {initial && <span className="form-id-hint">Editando "{initial.name}"</span>}
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onSave({
            id: initial?.id, name: name.trim(), unit, quantity: Math.max(0, parseFloat(quantity) || 0),
            parLevel: Math.max(0, parseFloat(parLevel) || DEFAULT_PAR[unit] || 750),
            step: Math.max(0, parseFloat(step) || DEFAULT_STEP[unit] || 1),
            photo, links: links.filter((l) => l.url.trim()), notes,
            lowStockEnabled, lowStockThreshold: lowStockEnabled ? Math.max(0, parseFloat(lowStockThreshold) || 0) : null,
            price: price === "" ? null : Math.max(0, parseFloat(price) || 0),
            categoryId: categoryId || null,
          })}>Guardar</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- RECETAS ----------
function RecetasTab({ recipes, search, setSearch, onNew, onView, onAddToShopping, onMake }) {
  const filtered = recipes.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <header className="page-header page-header-row">
        <div><h1>Recetas</h1><p className="page-sub">{recipes.length} recetas en el recetario.</p></div>
        <button className="btn btn-primary" onClick={onNew}><Plus size={16} /> Receta</button>
      </header>
      <div className="search-box"><Search size={15} /><input placeholder="Buscar receta…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {filtered.length === 0 ? (
        <Empty icon={BookOpen} title="Sin recetas todavía" body="Anota tu primera receta: foto, categorías, ingredientes y preparación." />
      ) : (
        <div className="grid-cards">
          {filtered.map((r) => (
            <div key={r.id} style={{ position: "relative" }}>
              <RecipeCard recipe={r} onClick={() => onView(r)} onAddToShopping={() => onAddToShopping(r)} onMake={() => onMake(r)} iconActions />
              {!r.available && <span className="unavailable-flag">Faltan ingredientes</span>}
              {r.available && r.usedAlt && <span className="substituted-flag">Con sustitución</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Resuelve la elección del picker principal de ingredientes de receta (o de la
// alternativa): puede resultar en un ingrediente concreto o en una categoría.
function resolveSlotRef({ activeId, query, ingredients, categories, onCreateIngredient }) {
  if (activeId) {
    if (activeId.startsWith("cat:")) {
      const id = activeId.slice(4);
      if (categories.some((c) => c.id === id)) return { kind: "category", id };
    } else if (activeId.startsWith("ing:")) {
      const id = activeId.slice(4);
      if (ingredients.some((i) => i.id === id)) return { kind: "ingredient", id };
    }
  }
  const q = query.trim().toLowerCase();
  const exactCat = categories.find((c) => c.name.toLowerCase() === q);
  if (exactCat) return { kind: "category", id: exactCat.id };
  const exactIng = ingredients.find((i) => i.name.toLowerCase() === q);
  if (exactIng) return { kind: "ingredient", id: exactIng.id };
  if (query.trim()) {
    const created = onCreateIngredient(query.trim());
    if (created) return { kind: "ingredient", id: created.id };
  }
  return null;
}

function OptionCombo({ options, value, onChange, placeholder }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);
  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  function choose(opt) { setQuery(opt); onChange(opt); setOpen(false); }

  return (
    <div className="combo" ref={boxRef}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && (
        <div className="combo-dropdown">
          {matches.length === 0 && <div className="combo-empty">Sin coincidencias</div>}
          {matches.map((o) => <div key={o} className="combo-option" onClick={() => choose(o)}>{o}</div>)}
        </div>
      )}
    </div>
  );
}

function IngredientCombo({ ingredients, categories, query, setQuery, activeId, setActiveId, onCreateIngredient, placeholder, autoFocus }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q ? ingredients.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 6) : ingredients.slice(0, 6);
  const catMatches = categories ? (q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories) : [];
  const exactMatch = ingredients.find((i) => i.name.toLowerCase() === q);

  // Cuando hay categorías disponibles (solo en el picker principal de la receta),
  // activeId se guarda con prefijo "cat:"/"ing:" para distinguir el tipo elegido.
  function select(id, name, kind) {
    setQuery(name);
    setActiveId(categories ? `${kind}:${id}` : id);
    setOpen(false);
  }
  function createAndChoose(name) {
    const ing = onCreateIngredient(name);
    if (!ing) return;
    select(ing.id, ing.name, "ing");
  }

  return (
    <div className="combo" ref={boxRef}>
      <input
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActiveId(null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && (
        <div className="combo-dropdown">
          {catMatches.map((c) => (
            <div key={`cat-${c.id}`} className="combo-option combo-option-category" onClick={() => select(c.id, c.name, "cat")}>
              <span className="alt-tag">categoría</span> {c.name}
            </div>
          ))}
          {matches.map((i) => (
            <div key={i.id} className="combo-option" onClick={() => select(i.id, i.name, "ing")}>{i.name}</div>
          ))}
          {q && !exactMatch && (
            <div className="combo-option combo-create" onClick={() => createAndChoose(query.trim())}>
              <Plus size={13} /> Crear "{query.trim()}"
            </div>
          )}
          {!q && matches.length === 0 && catMatches.length === 0 && <div className="combo-empty">Escribe para buscar o crear un ingrediente</div>}
        </div>
      )}
    </div>
  );
}

function AltEditor({ ingredients, categories, onCreateIngredient, onConfirm, onCancel }) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [amount, setAmount] = useState(30);
  const [unit, setUnit] = useState("ml");

  function confirm() {
    const ref = resolveSlotRef({ activeId, query, ingredients, categories: categories || [], onCreateIngredient });
    if (!ref) return;
    const amt = Math.max(0, parseFloat(amount) || 0);
    if (amt <= 0) return;
    if (ref.kind === "category") onConfirm({ categoryId: ref.id, amount: amt, unit });
    else onConfirm({ ingredientId: ref.id, amount: amt, unit });
  }

  return (
    <div className="alt-row-edit">
      <IngredientCombo ingredients={ingredients} categories={categories} query={query} setQuery={setQuery} activeId={activeId} setActiveId={setActiveId} onCreateIngredient={onCreateIngredient} placeholder="Ingrediente o categoría alternativa…" autoFocus />
      <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 56 }} />
      <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 80 }}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
      <button type="button" className="icon-btn" onClick={confirm}><Check size={14} /></button>
      <button type="button" className="icon-btn" onClick={onCancel}><X size={14} /></button>
    </div>
  );
}

function IngredientPicker({ ingredients, categories, items, setItems, onCreateIngredient }) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [amount, setAmount] = useState(30);
  const [unit, setUnit] = useState("ml");
  const [altEditingIdx, setAltEditingIdx] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  function add() {
    const ref = resolveSlotRef({ activeId, query, ingredients, categories: categories || [], onCreateIngredient });
    if (!ref) return;
    const amt = Math.max(0, parseFloat(amount) || 0);
    if (amt <= 0) return;
    if (ref.kind === "category") setItems([...items, { categoryId: ref.id, amount: amt, unit, alt: null }]);
    else setItems([...items, { ingredientId: ref.id, amount: amt, unit, alt: null }]);
    setQuery("");
    setActiveId(null);
  }
  function remove(idx) { setItems(items.filter((_, i) => i !== idx)); }
  function setAlt(idx, alt) { setItems(items.map((it, i) => (i === idx ? { ...it, alt } : it))); }
  function removeAlt(idx) { setItems(items.map((it, i) => (i === idx ? { ...it, alt: null } : it))); }
  function reorder(from, to) {
    if (from === null || to === null || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
  }

  return (
    <div>
      <div className="picker-row">
        <IngredientCombo ingredients={ingredients} categories={categories} query={query} setQuery={setQuery} activeId={activeId} setActiveId={setActiveId} onCreateIngredient={onCreateIngredient} placeholder="Buscar ingrediente o categoría…" />
        <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 64 }} />
        <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 92 }}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
        <button type="button" className="btn btn-ghost btn-sm" onClick={add} disabled={!query.trim() && !activeId}><Plus size={14} /></button>
      </div>
      <p className="combo-hint">Si el ingrediente no existe todavía, se crea en el inventario con cantidad 0. Arrastra el icono de la izquierda para reordenar.</p>
      {items.length > 0 && (
        <ul className="picked-list">
          {items.map((it, idx) => {
            const isCat = !!it.categoryId;
            const cat = isCat ? (categories || []).find((c) => c.id === it.categoryId) : null;
            const ing = !isCat ? ingredients.find((i) => i.id === it.ingredientId) : null;
            const altIng = it.alt && !it.alt.categoryId ? ingredients.find((i) => i.id === it.alt.ingredientId) : null;
            const altCat = it.alt?.categoryId ? (categories || []).find((c) => c.id === it.alt.categoryId) : null;
            return (
              <li
                key={idx}
                className={`picked-item ${dragIdx === idx ? "picked-item-dragging" : ""} ${overIdx === idx && dragIdx !== null && dragIdx !== idx ? "picked-item-over" : ""}`}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => { e.preventDefault(); setOverIdx(idx); }}
                onDragLeave={() => setOverIdx((cur) => (cur === idx ? null : cur))}
                onDrop={(e) => { e.preventDefault(); reorder(dragIdx, idx); setDragIdx(null); setOverIdx(null); }}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              >
                <div className="picked-main">
                  <span className="drag-handle" title="Arrastra para reordenar"><GripVertical size={14} /></span>
                  {isCat && <span className="alt-tag">categoría</span>}
                  <span>{isCat ? (cat ? cat.name : "Categoría eliminada") : (ing ? ing.name : "?")}</span>
                  <span className="picked-amount">{it.amount} {it.unit}</span>
                  <button type="button" onClick={() => remove(idx)}><X size={13} /></button>
                </div>
                {it.alt ? (
                  <div className="picked-alt">
                    <span className="alt-tag">alt.</span>
                    {it.alt.categoryId && <span className="alt-tag">categoría</span>}
                    <span>{it.alt.categoryId ? (altCat ? altCat.name : "Categoría eliminada") : (altIng ? altIng.name : "?")}</span>
                    <span className="picked-amount">{it.alt.amount} {it.alt.unit}</span>
                    <button type="button" onClick={() => removeAlt(idx)}><X size={13} /></button>
                  </div>
                ) : altEditingIdx === idx ? (
                  <AltEditor
                    ingredients={ingredients}
                    categories={categories}
                    onCreateIngredient={onCreateIngredient}
                    onConfirm={(alt) => { setAlt(idx, alt); setAltEditingIdx(null); }}
                    onCancel={() => setAltEditingIdx(null)}
                  />
                ) : (
                  <button type="button" className="add-alt-btn" onClick={() => setAltEditingIdx(idx)}><Plus size={12} /> Alternativa</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RecipeForm({ initial, ingredients, ingredientCategories, onCancel, onSave, onCreateIngredient }) {
  const [name, setName] = useState(initial?.name || "");
  const [categories, setCategories] = useState(initial?.categories || []);
  const [photo, setPhoto] = useState(initial?.photo || null);
  const [mainIngredients, setMainIngredients] = useState(initial?.mainIngredients || []);
  const [otherIngredients, setOtherIngredients] = useState(initial?.otherIngredients || "");
  const [preparation, setPreparation] = useState(initial?.preparation || "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty || "Fácil");
  const [time, setTime] = useState(initial?.time ?? 5);
  const [iceType, setIceType] = useState(initial?.iceType || "");
  const [glassType, setGlassType] = useState(initial?.glassType || "");
  const [notes, setNotes] = useState(initial?.notes || "");

  function toggleCat(id) {
    setCategories((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }

  return (
    <Modal title={initial?.id ? "Editar receta" : "Nueva receta"} onClose={onCancel} wide>
      <div className="form">
        <PhotoUpload photo={photo} onPhoto={setPhoto} maxW={500} />

        <Field label="Nombre"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Negroni" /></Field>

        <div className="field-row">
          <Field label="Dificultad"><select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>{DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}</select></Field>
          <Field label="Tiempo (min)"><input type="number" min="0" step="any" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>

        <div className="field-row">
          <Field label="Tipo de hielo recomendado">
            <OptionCombo options={ICE_TYPES} value={iceType} onChange={setIceType} placeholder="Buscar o escribir…" />
          </Field>
          <Field label="Tipo de vaso recomendado">
            <OptionCombo options={GLASS_TYPES} value={glassType} onChange={setGlassType} placeholder="Buscar o escribir…" />
          </Field>
        </div>

        <Field label="Categorías (puedes marcar varias)">
          <div className="cat-select">
            {RECIPE_CATS.map((c) => (
              <button type="button" key={c.id} className={`cat-chip cat-${c.id} ${categories.includes(c.id) ? "cat-chip-active" : ""}`} onClick={() => toggleCat(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Ingredientes principales (determinan si la receta está disponible — arrastra para reordenar)">
          <IngredientPicker ingredients={ingredients} categories={ingredientCategories} items={mainIngredients} setItems={setMainIngredients} onCreateIngredient={onCreateIngredient} />
        </Field>

        <Field label="Otros ingredientes / guarnición (texto libre)">
          <textarea rows={6} value={otherIngredients} onChange={(e) => setOtherIngredients(e.target.value)} placeholder="Piel de naranja, hielo…" />
        </Field>

        <Field label="Preparación">
          <textarea rows={6} value={preparation} onChange={(e) => setPreparation(e.target.value)} placeholder="1. Verter todos los ingredientes en la coctelera con hielo…&#10;2. Agitar 15 segundos&#10;(admite markdown: listas numeradas, **negrita**, etc.)" />
        </Field>

        <Field label="Notas / comentarios"><textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Variaciones, truco de la casa… (admite markdown: listas, **negrita**, etc.)" /></Field>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button
            className="btn btn-primary"
            disabled={!name.trim() || mainIngredients.length === 0 || categories.length === 0}
            onClick={() => onSave({
              id: initial?.id, name: name.trim(), categories, photo, mainIngredients,
              otherIngredients, preparation, difficulty, time: Math.max(0, parseFloat(time) || 0), notes,
              iceType, glassType,
              timesMade: initial?.timesMade || 0,
            })}
          >Guardar receta</button>
        </div>
      </div>
    </Modal>
  );
}

function RecipeDetail({ recipe, ingredients, ingredientsById, categoriesById, onClose, onEdit, onDelete, onMake, onAddMissing, onAddAll, onClone }) {
  return (
    <Modal title={recipe.name} onClose={onClose} wide>
      <div className="detail">
        {recipe.photo && <ZoomableImage src={recipe.photo} alt={recipe.name} className="detail-photo" />}
        <div className="detail-tags">
          <CatPills ids={recipe.categories || []} />
          <Badge>{recipe.difficulty}</Badge>
          <Badge>{recipe.time} min</Badge>
          <Badge tone={recipe.available ? "success" : "danger"}>{recipe.available ? "Disponible" : "Faltan ingredientes"}</Badge>
          {recipe.usedAlt && <Badge tone="info">Con sustitución</Badge>}
          {recipe.glassType && <Badge>{recipe.glassType}</Badge>}
          {recipe.iceType && <Badge>Hielo: {recipe.iceType}</Badge>}
          {recipe.cost?.hasPrice && <Badge>{recipe.cost.complete ? "" : "~"}{eurFormat.format(recipe.cost.total)}</Badge>}
        </div>

        <h4>Ingredientes principales</h4>
        <ul className="detail-ing-list">
          {recipe.mainIngredients.map((mi, idx) => {
            const m = recipe.missing?.find((x) => (mi.categoryId ? x.categoryId === mi.categoryId : x.ingredientId === mi.ingredientId));
            const primary = resolveSlot(mi, ingredients, ingredientsById, categoriesById);
            const altRes = mi.alt ? resolveSlot(mi.alt, ingredients, ingredientsById, categoriesById) : null;
            return (
              <li key={idx} className={m ? "detail-ing-missing" : ""}>
                <div>
                  {mi.amount} {mi.unit} — {primary.label}
                  {mi.categoryId && <span className="alt-tag">categoría</span>}
                  {m && <span className="missing-tag">faltan {m.need} {m.unit}</span>}
                </div>
                {mi.categoryId && primary.chosen && (
                  <div className="detail-alt-line">
                    ↳ marca usada: {primary.chosen.name}{!primary.isDefault && <span className="alt-in-use"> (no es la recomendada)</span>}
                  </div>
                )}
                {mi.alt && (
                  <div className="detail-alt-line">
                    ↳ alternativa: {mi.alt.amount} {mi.alt.unit} de {altRes.label}
                    {mi.alt.categoryId && <span className="alt-tag">categoría</span>}
                    {!primary.ok && altRes.ok && <span className="alt-in-use"> (en uso{mi.alt.categoryId && altRes.chosen ? `: ${altRes.chosen.name}` : ""})</span>}
                    {!primary.ok && !altRes.ok && <span className="missing-tag"> también falta</span>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {recipe.otherIngredients && (<><h4>Otros ingredientes</h4><p className="detail-text">{recipe.otherIngredients}</p></>)}

        <h4>Preparación</h4>
        <Markdown text={recipe.preparation} />

        {recipe.notes && (<><h4>Notas</h4><Markdown text={recipe.notes} /></>)}

        {recipe.timesMade > 0 && <p className="detail-times">Servida {recipe.timesMade} veces</p>}

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onDelete}><Trash2 size={14} /> Eliminar</button>
          <button className="btn btn-ghost" onClick={() => onClone(recipe)}><Copy size={14} /> Clonar</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onEdit}>Editar</button>
          <button className="btn btn-ghost" onClick={() => onAddAll(recipe)}><ShoppingCart size={14} /> Añadir todo a la compra</button>
          {recipe.available ? (
            <button className="btn btn-primary" onClick={() => { onMake(recipe); onClose(); }}><Check size={14} /> Marcar como servida</button>
          ) : (
            <button className="btn btn-primary" onClick={() => onAddMissing(recipe, recipe.missing)}><ShoppingCart size={14} /> Añadir faltantes</button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---------- MANUAL ----------
function ManualTab({ entries, onNew, onEdit, onDelete, onReorder, onView }) {
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  return (
    <div>
      <header className="page-header page-header-row">
        <div><h1>Manual</h1><p className="page-sub">Tu wiki personal de coctelería. {entries.length} apunte{entries.length === 1 ? "" : "s"}.</p></div>
        <button className="btn btn-primary" onClick={onNew}><Plus size={16} /> Apunte</button>
      </header>

      {entries.length === 0 ? (
        <Empty icon={BookOpen} title="Todavía no hay apuntes" body="Anota lo que quieras recordar: tipos de vaso, técnicas, notas de cata… con markdown e imágenes." />
      ) : (
        <>
          {entries.length > 1 && <p className="combo-hint" style={{ marginBottom: 14 }}>Arrastra el icono de la izquierda para reordenar.</p>}
          <div className="manual-list">
            {entries.map((e) => (
              <div
                key={e.id}
                className={`manual-row ${dragId === e.id ? "manual-row-dragging" : ""} ${overId === e.id && dragId && dragId !== e.id ? "manual-row-over" : ""}`}
                draggable
                onDragStart={() => setDragId(e.id)}
                onDragOver={(ev) => { ev.preventDefault(); setOverId(e.id); }}
                onDragLeave={() => setOverId((cur) => (cur === e.id ? null : cur))}
                onDrop={(ev) => { ev.preventDefault(); if (dragId) onReorder(dragId, e.id); setDragId(null); setOverId(null); }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
              >
                {entries.length > 1 && <span className="drag-handle" title="Arrastra para reordenar"><GripVertical size={14} /></span>}
                <span className="manual-title" onClick={() => onView(e)}>{e.title}</span>
                <button className="icon-btn" title="Editar" onClick={() => onEdit(e)}><Pencil size={14} /></button>
                <button className="icon-btn" title="Eliminar" onClick={() => onDelete(e.id)}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ManualEntryForm({ initial, onCancel, onSave }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);

  function insertAtCursor(text) {
    const ta = textareaRef.current;
    if (!ta) { setContent((c) => c + text); return; }
    const start = ta.selectionStart ?? content.length;
    const end = ta.selectionEnd ?? content.length;
    const next = content.slice(0, start) + text + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleImageFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    setUploadError("");
    try {
      const dataUrl = await resizeImage(file, 1000, 0.82);
      const { url } = await api.uploadImage(dataUrl);
      insertAtCursor(`\n![imagen](${url})\n`);
    } catch (err) {
      setUploadError(err.message || "No se ha podido subir la imagen.");
    }
    setUploading(false);
  }

  return (
    <Modal title={initial ? "Editar apunte" : "Nuevo apunte"} onClose={onCancel} wide>
      <div className="form">
        <Field label="Título"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tipos de vaso y su uso" /></Field>

        <Field label="Contenido (markdown)">
          <div className="manual-editor-toolbar">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()} disabled={uploading}>
              <ImageIcon size={14} /> {uploading ? "Subiendo…" : "Insertar imagen"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) handleImageFile(f); e.target.value = ""; }} />
          </div>
          {uploadError && <p className="auth-error" style={{ marginBottom: 6 }}>{uploadError}</p>}
          <textarea
            ref={textareaRef}
            rows={14}
            className={`manual-textarea ${dragging ? "manual-textarea-dragging" : ""}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files && e.dataTransfer.files[0];
              if (file) handleImageFile(file);
            }}
            placeholder={"# Título del apartado\n\nTexto con **negrita**, *cursiva* y listas:\n- Punto uno\n- Punto dos\n\nArrastra una imagen aquí o usa el botón de arriba."}
          />
        </Field>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" disabled={!title.trim()} onClick={() => onSave({ id: initial?.id, title: title.trim(), content })}>Guardar</button>
        </div>
      </div>
    </Modal>
  );
}

function ManualEntryDetail({ entry, onClose, onEdit, onDelete }) {
  return (
    <Modal title={entry.title} onClose={onClose} wide>
      <div className="detail">
        <Markdown text={entry.content} />
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onDelete}><Trash2 size={14} /> Eliminar</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onEdit}>Editar</button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- COMPRA ----------
function CompraTab({ items, archivedRecipes, onToggle, onRemove, onClear, onAdd, onAddSuggestion }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState("unidades");
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const pending = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  const suggestions = useMemo(() => {
    const map = new Map();
    (archivedRecipes || []).forEach((r) => {
      if (!r.missing || r.missing.length !== 1) return;
      const m = r.missing[0];
      const key = m.categoryId || m.ingredientId || m.name;
      if (!map.has(key)) {
        map.set(key, { key, name: m.name, ingredientId: m.ingredientId || null, categoryId: m.categoryId || null, unit: m.unit, need: m.need, recipeNames: [] });
      }
      const entry = map.get(key);
      entry.need = Math.max(entry.need, m.need);
      entry.recipeNames.push(r.name);
    });
    return Array.from(map.values()).sort((a, b) => b.recipeNames.length - a.recipeNames.length);
  }, [archivedRecipes]);
  const visibleSuggestions = showAllSuggestions ? suggestions : suggestions.slice(0, 3);

  return (
    <div>
      <header className="page-header"><h1>Lista de la compra</h1><p className="page-sub">{pending.length} pendientes.</p></header>

      {suggestions.length > 0 && (
        <div className="suggestions-block">
          <h3 className="panel-title">Comprando esto, desbloqueas más recetas</h3>
          <div className="suggestions-list">
            {visibleSuggestions.map((s) => (
              <div key={s.key} className="suggestion-row">
                <div className="suggestion-info">
                  <span className="suggestion-name">{s.name}</span>
                  <span className="suggestion-detail">
                    Desbloquea {s.recipeNames.length} receta{s.recipeNames.length === 1 ? "" : "s"}: {s.recipeNames.join(", ")}
                  </span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => onAddSuggestion(s)}><Plus size={14} /> Añadir</button>
              </div>
            ))}
          </div>
          {suggestions.length > 3 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAllSuggestions((v) => !v)}>
              {showAllSuggestions ? "Mostrar menos" : `Mostrar más (${suggestions.length - 3})`}
            </button>
          )}
        </div>
      )}

      <div className="add-item-row">
        <input placeholder="Ingrediente a comprar…" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 70 }} />
        <select value={unit} onChange={(e) => setUnit(e.target.value)}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
        <button className="btn btn-primary btn-sm" onClick={() => { onAdd(name, parseFloat(amount), unit); setName(""); }}><Plus size={14} /></button>
      </div>

      {items.length === 0 ? (
        <Empty icon={ShoppingCart} title="Lista vacía" body="Cuando te falte algo para una receta, añádelo aquí desde Home o Recetas." />
      ) : (
        <>
          <div className="shop-list">
            {pending.map((item) => (
              <div key={item.id} className="shop-row">
                <button className="checkbox" onClick={() => onToggle(item.id)} />
                <div className="shop-info"><span>{item.name}</span>{item.fromRecipe && <span className="shop-source">para {item.fromRecipe}</span>}</div>
                <span className="shop-amount">{item.amount} {item.unit}</span>
                <button className="icon-btn" onClick={() => onRemove(item.id)}><X size={14} /></button>
              </div>
            ))}
          </div>
          {checked.length > 0 && (
            <>
              <div className="shop-list shop-list-checked">
                {checked.map((item) => (
                  <div key={item.id} className="shop-row shop-row-checked">
                    <button className="checkbox checkbox-checked" onClick={() => onToggle(item.id)}><Check size={12} /></button>
                    <div className="shop-info"><span>{item.name}</span></div>
                    <span className="shop-amount">{item.amount} {item.unit}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={onClear}>Vaciar comprados</button>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---------- AJUSTES ----------
function AjustesTab({ settings, setSettings, counts, username, onExport, onImport, onChangePassword }) {
  const importRef = useRef(null);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwStatus, setPwStatus] = useState(null); // { type: "error"|"success", text }
  const [pwBusy, setPwBusy] = useState(false);

  function handleImportFile(e) {
    const file = e.target.files[0];
    if (file) onImport(file);
    e.target.value = "";
  }

  async function submitPasswordChange(e) {
    e.preventDefault();
    setPwStatus(null);
    if (!currentPw || !newPw) { setPwStatus({ type: "error", text: "Rellena ambos campos." }); return; }
    if (newPw !== newPw2) { setPwStatus({ type: "error", text: "La nueva contraseña no coincide en los dos campos." }); return; }
    setPwBusy(true);
    try {
      await onChangePassword(currentPw, newPw);
      setPwStatus({ type: "success", text: "Contraseña actualizada." });
      setCurrentPw(""); setNewPw(""); setNewPw2("");
    } catch (err) {
      setPwStatus({ type: "error", text: err.message || "No se ha podido cambiar la contraseña." });
    }
    setPwBusy(false);
  }

  return (
    <div>
      <header className="page-header"><h1>Ajustes</h1><p className="page-sub">Personaliza tu barra.</p></header>
      <div className="panel" style={{ maxWidth: 440 }}>
        <h3 className="panel-title">Apariencia</h3>
        <div className="theme-toggle">
          <button className={`theme-opt ${settings.theme === "dark" ? "theme-opt-active" : ""}`} onClick={() => setSettings((s) => ({ ...s, theme: "dark" }))}><Moon size={16} /> Turno de noche</button>
          <button className={`theme-opt ${settings.theme === "light" ? "theme-opt-active" : ""}`} onClick={() => setSettings((s) => ({ ...s, theme: "light" }))}><Sun size={16} /> Turno de día</button>
        </div>

        <h3 className="panel-title" style={{ marginTop: 24 }}>Nombre de la barra</h3>
        <input value={settings.barName} onChange={(e) => setSettings((s) => ({ ...s, barName: e.target.value }))} />

        <h3 className="panel-title" style={{ marginTop: 24 }}>Datos</h3>
        <div className="data-actions">
          <button className="btn btn-ghost btn-sm" onClick={onExport}><Download size={14} /> Exportar todo (JSON)</button>
          <button className="btn btn-ghost btn-sm" onClick={() => importRef.current.click()}><Upload size={14} /> Importar desde JSON</button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
        </div>
        <p className="empty-body" style={{ margin: "6px 0 0" }}>Importar reemplaza por completo tu inventario, recetas y lista de la compra actuales.</p>

        <h3 className="panel-title" style={{ marginTop: 24 }}>Cambiar contraseña</h3>
        <form className="form" onSubmit={submitPasswordChange}>
          <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Contraseña actual" />
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Nueva contraseña (mín. 6 caracteres)" />
          <input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} placeholder="Repite la nueva contraseña" />
          {pwStatus && <p className={pwStatus.type === "error" ? "auth-error" : "pw-success"}>{pwStatus.text}</p>}
          <button className="btn btn-primary btn-sm" type="submit" disabled={pwBusy}>Actualizar contraseña</button>
        </form>

        <h3 className="panel-title" style={{ marginTop: 24 }}>Cuenta</h3>
        <p className="empty-body" style={{ margin: 0 }}>
          Sesión de <strong>{username}</strong> · {counts.ingredients} ingredientes · {counts.recipes} recetas guardadas y separadas del resto de usuarios.
        </p>
      </div>
    </div>
  );
}

// ---------- Shared UI ----------
function Lightbox({ src, onClose }) {
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}><X size={20} /></button>
      <img src={src} alt="" className="lightbox-img" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function ZoomableImage({ src, alt, className }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={`zoomable-image ${className || ""}`} onClick={() => setOpen(true)}>
        <img src={src} alt={alt || ""} />
        <span className="photo-view-btn" title="Ver imagen completa"><Maximize2 size={14} /></span>
      </div>
      {open && <Lightbox src={src} onClose={() => setOpen(false)} />}
    </>
  );
}

function PhotoUpload({ photo, onPhoto, small, maxW = 500 }) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  async function processFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const dataUrl = await resizeImage(file, maxW);
    onPhoto(dataUrl);
  }

  return (
    <>
      <div
        className={`photo-upload ${small ? "photo-upload-sm" : ""} ${dragging ? "photo-upload-dragging" : ""}`}
        onClick={() => fileRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files && e.dataTransfer.files[0];
          if (file) processFile(file);
        }}
      >
        {photo ? (
          <>
            <img src={photo} alt="" />
            <button type="button" className="photo-view-btn" title="Ver imagen completa" onClick={(e) => { e.stopPropagation(); setLightbox(true); }}>
              <Maximize2 size={14} />
            </button>
          </>
        ) : (
          <>
            <Camera size={small ? 20 : 22} />
            <span>{dragging ? "Suelta la imagen aquí…" : "Añadir foto, o arrástrala aquí"}</span>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; if (f) processFile(f); }} />
      </div>
      {lightbox && photo && <Lightbox src={photo} onClose={() => setLightbox(false)} />}
    </>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h2>{title}</h2><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

      .app {
        --font-display: 'Fraunces', serif;
        --font-body: 'Inter', sans-serif;
        --font-mono: 'IBM Plex Mono', monospace;
        font-family: var(--font-body);
        display: flex;
        min-height: 100vh;
      }
      .theme-dark {
        --bg: #17130F; --bg-panel: #221C16; --bg-panel-2: #2B241C;
        --border: #3A2F24; --text: #EDE3D3; --text-dim: #A99A85;
        --accent: #C17A3D; --accent-tint: #3A2C1D; --accent-2: #8A9A5B;
        --cool: #5B93A0; --plum: #9C6A83; --danger: #C86A5C; --favorite: #E3B23C;
      }
      .theme-light {
        --bg: #EDEEE6; --bg-panel: #FFFFFF; --bg-panel-2: #F5F5EF;
        --border: #D8D8CC; --text: #2A2620; --text-dim: #746C5E;
        --accent: #A85A2A; --accent-tint: #F1E2D2; --accent-2: #5E7A3D;
        --cool: #2E6B78; --plum: #6B3A52; --danger: #A83A30; --favorite: #A67C1E;
      }
      .app, .app * { box-sizing: border-box; }
      .app { background: var(--bg); color: var(--text); }
      h1, h2, h3, h4 { font-family: var(--font-display); font-weight: 500; margin: 0; }
      input, select, textarea, button { font-family: var(--font-body); color: var(--text); }
      input, select, textarea {
        background: var(--bg-panel-2); border: 1px solid var(--border); border-radius: 7px;
        padding: 8px 10px; font-size: 13.5px; width: 100%; outline: none;
      }
      input:focus, select:focus, textarea:focus { border-color: var(--accent); }
      input[type=number] { font-family: var(--font-mono); }

      .sidebar {
        width: 190px; flex-shrink: 0; background: var(--bg-panel); border-right: 1px solid var(--border);
        padding: 18px 12px; display: flex; flex-direction: column; gap: 3px;
      }
      .brand { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-size: 16px; padding: 4px 10px 18px; color: var(--accent); }
      .navbtn {
        display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px;
        background: none; border: none; cursor: pointer; color: var(--text-dim); font-size: 13.5px;
        text-align: left; position: relative;
      }
      .navbtn:hover { background: var(--bg-panel-2); color: var(--text); }
      .navbtn-active { background: var(--accent-tint); color: var(--accent); }
      .navbtn-label { flex: 1; }
      .navbtn-badge { background: var(--accent); color: var(--bg-panel); font-size: 10px; font-family: var(--font-mono); border-radius: 10px; padding: 1px 6px; }
      .sidebar-user { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 10px; border-top: 1px solid var(--border); }
      .sidebar-username { font-size: 12px; color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .main { flex: 1; padding: 28px 32px; overflow-y: auto; }
      .page-header { margin-bottom: 22px; }
      .page-header-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
      .header-btn-group { display: flex; gap: 8px; }
      .page-header h1 { font-size: 24px; }
      .page-sub { color: var(--text-dim); font-size: 13px; margin: 4px 0 0; }

      .btn {
        display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 7px;
        border: 1px solid var(--border); background: var(--bg-panel-2); cursor: pointer; font-size: 13px; font-weight: 500;
      }
      .btn:hover { border-color: var(--accent); }
      .btn:disabled { opacity: .45; cursor: not-allowed; }
      .btn-primary { background: var(--accent); border-color: var(--accent); color: var(--bg-panel); }
      .btn-primary:hover { filter: brightness(1.08); }
      .btn-ghost { background: transparent; }
      .btn-sm { padding: 5px 10px; font-size: 12px; }
      .btn-block { width: 100%; justify-content: center; margin-top: 8px; }
      .icon-btn { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 4px; border-radius: 6px; }
      .icon-btn:hover { background: var(--bg-panel-2); color: var(--danger); }

      .search-box { display: flex; align-items: center; gap: 8px; background: var(--bg-panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 7px 12px; margin-bottom: 18px; color: var(--text-dim); max-width: 340px; }
      .search-box input { border: none; background: none; padding: 0; }

      .empty { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 30px 0; color: var(--text-dim); }
      .empty-title { font-family: var(--font-display); font-size: 15px; color: var(--text); margin: 4px 0 0; }
      .empty-body { font-size: 13px; max-width: 340px; }

      .cat-filter-row { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 20px; }
      .cat-filter-chip { padding: 6px 14px; border-radius: 16px; border: 1px solid var(--border); background: var(--bg-panel-2); font-size: 12.5px; cursor: pointer; color: var(--text-dim); }
      .cat-filter-chip:hover { color: var(--text); }
      .cat-filter-active.cat-filter-aperitivo { background: var(--accent); border-color: var(--accent); color: var(--bg-panel); }
      .cat-filter-active.cat-filter-digestivo { background: var(--plum); border-color: var(--plum); color: var(--bg-panel); }
      .cat-filter-active.cat-filter-reconstituyente { background: var(--accent-2); border-color: var(--accent-2); color: var(--bg-panel); }
      .cat-filter-active.cat-filter-refrescante { background: var(--cool); border-color: var(--cool); color: var(--bg-panel); }
      .cat-filter-active.cat-filter-favorito { background: var(--favorite); border-color: var(--favorite); color: var(--bg-panel); }
      .cat-filter-chip.cat-filter-active:not([class*="cat-filter-aperitivo"]):not([class*="cat-filter-digestivo"]):not([class*="cat-filter-reconstituyente"]):not([class*="cat-filter-refrescante"]):not([class*="cat-filter-favorito"]) { background: var(--text); border-color: var(--text); color: var(--bg); }

      .grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
      .recipe-card { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
      .recipe-card-photo { height: 110px; background: var(--bg-panel-2); display: flex; align-items: center; justify-content: center; color: var(--text-dim); position: relative; cursor: pointer; }
      .recipe-card-photo img { width: 100%; height: 100%; object-fit: cover; }
      .recipe-card-body { padding: 12px; }
      .recipe-card-body h3 { font-size: 14.5px; cursor: pointer; }
      .recipe-card-meta { display: flex; gap: 6px; color: var(--text-dim); font-size: 11.5px; margin-top: 4px; font-family: var(--font-mono); }
      .unavailable-flag { position: absolute; top: 8px; right: 8px; background: var(--danger); color: var(--bg-panel); font-size: 10px; padding: 3px 7px; border-radius: 10px; font-weight: 500; }
      .substituted-flag { position: absolute; top: 8px; right: 8px; background: var(--cool); color: var(--bg-panel); font-size: 10px; padding: 3px 7px; border-radius: 10px; font-weight: 500; }
      .card-icon-actions { display: flex; gap: 6px; margin-top: 8px; }
      .icon-card-btn { flex: 1; display: flex; align-items: center; justify-content: center; height: 32px; border-radius: 7px; border: 1px solid var(--border); background: var(--bg-panel-2); color: var(--text-dim); cursor: pointer; }
      .icon-card-btn:hover { border-color: var(--accent); color: var(--text); }
      .icon-card-btn-primary { background: var(--accent); border-color: var(--accent); color: var(--bg-panel); }
      .icon-card-btn-primary:hover { filter: brightness(1.08); color: var(--bg-panel); }
      .icon-card-btn:disabled { opacity: .35; cursor: not-allowed; }

      .cat-pills { position: absolute; bottom: 8px; left: 8px; right: 8px; display: flex; flex-wrap: wrap; gap: 4px; }
      .cat-pill { font-size: 10px; padding: 3px 8px; border-radius: 10px; font-weight: 600; }
      .cat-pills-md .cat-pill { font-size: 11px; }
      .detail-tags .cat-pills { position: static; display: inline-flex; gap: 6px; }
      .cat-aperitivo { background: var(--accent); color: var(--bg-panel); }
      .cat-digestivo { background: var(--plum); color: var(--bg-panel); }
      .cat-reconstituyente { background: var(--accent-2); color: var(--bg-panel); }
      .cat-refrescante { background: var(--cool); color: var(--bg-panel); }
      .cat-favorito { background: var(--favorite); color: var(--bg-panel); }

      .collapse-toggle { display: flex; align-items: center; gap: 6px; background: none; border: none; color: var(--text-dim); cursor: pointer; margin: 22px 0 10px; font-size: 13px; padding: 0; }
      .archived-list { display: flex; flex-direction: column; gap: 1px; border-radius: 10px; overflow: hidden; border: 1px solid var(--border); }
      .archived-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--bg-panel); padding: 10px 14px; }
      .archived-info { cursor: pointer; }
      .archived-name { display: block; font-size: 13.5px; }
      .archived-missing { display: block; font-size: 11.5px; color: var(--danger); margin-top: 2px; }

      .fillbar { width: 6px; border-radius: 4px; background: var(--bg-panel-2); border: 1px solid var(--border); overflow: hidden; display: flex; align-items: flex-end; flex-shrink: 0; }
      .fillbar-fill { width: 100%; background: var(--accent-2); }

      .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 26px; }
      .metric-card { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
      .metric-label { font-size: 11.5px; color: var(--text-dim); }
      .metric-value { font-family: var(--font-display); font-size: 26px; }
      .panel-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .panel { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
      .panel-title { font-size: 13px; color: var(--text-dim); margin-bottom: 12px; text-transform: uppercase; letter-spacing: .04em; }
      .rank-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .rank-list li { display: flex; align-items: center; gap: 10px; font-size: 13.5px; }
      .rank-num { font-family: var(--font-mono); color: var(--text-dim); width: 14px; }
      .rank-name { flex: 1; }
      .rank-count { font-family: var(--font-mono); color: var(--accent); }

      .ing-list { display: flex; flex-direction: column; gap: 6px; }
      .ing-row { display: flex; align-items: center; gap: 10px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 9px; padding: 8px 12px; transition: border-color .1s, opacity .1s; }
      .ing-row-dragging { opacity: .4; }
      .ing-row-over { border-color: var(--accent); }

      .cat-group-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 6px; }
      .cat-group { background: var(--bg-panel); border: 1.5px solid var(--border); border-radius: 10px; padding: 10px 12px; transition: border-color .1s, opacity .1s; }
      .cat-group-header { display: flex; align-items: center; gap: 8px; }
      .cat-group-name { font-family: var(--font-display); font-size: 14.5px; cursor: pointer; flex-shrink: 0; }
      .cat-group-total { flex: 1; font-size: 11.5px; color: var(--text-dim); font-family: var(--font-mono); }
      .cat-group-members { display: flex; flex-direction: column; gap: 6px; margin: 10px 0 0 30px; }
      .star-btn { background: none; border: none; color: var(--border); font-size: 16px; cursor: pointer; line-height: 1; flex-shrink: 0; }
      .star-btn-active { color: var(--favorite); }
      .combo-option-category { display: flex; align-items: center; gap: 6px; }

      .manual-list { display: flex; flex-direction: column; gap: 6px; }
      .manual-row { display: flex; align-items: center; gap: 10px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 9px; padding: 10px 12px; transition: border-color .1s, opacity .1s; }
      .manual-row-dragging { opacity: .4; }
      .manual-row-over { border-color: var(--accent); }
      .manual-title { flex: 1; font-size: 13.5px; cursor: pointer; }
      .manual-title:hover { color: var(--accent); }
      .manual-editor-toolbar { margin-bottom: 6px; }
      .manual-textarea { font-family: var(--font-mono); font-size: 12.5px; line-height: 1.6; transition: border-color .15s, background .15s; }
      .manual-textarea-dragging { border-color: var(--accent); background: var(--accent-tint); }
      .ing-thumb { width: 34px; height: 34px; border-radius: 8px; background: var(--bg-panel-2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-dim); overflow: hidden; flex-shrink: 0; }
      .ing-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .ing-info { flex: 1; cursor: pointer; display: flex; flex-direction: column; }
      .ing-name { font-size: 13.5px; display: flex; align-items: center; gap: 6px; }
      .low-stock-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; background: var(--danger); color: var(--bg-panel); padding: 2px 7px; border-radius: 8px; }
      .checkbox-row { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
      .checkbox-row input { width: auto; }
      .low-stock-amount { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-dim); margin-top: 8px; }
      .data-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .ing-unit { font-size: 11px; color: var(--text-dim); }
      .qty-stepper { display: flex; align-items: center; gap: 4px; }
      .qty-stepper button { width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-panel-2); display: flex; align-items: center; justify-content: center; cursor: pointer; }
      .qty-stepper input { width: 62px; text-align: center; padding: 5px; }
      .photo-upload-sm { height: 90px; }
      .links-list { display: flex; flex-direction: column; gap: 6px; }
      .link-row { display: flex; align-items: center; gap: 6px; border: 1.5px solid transparent; border-radius: 6px; padding: 2px; transition: border-color .1s, opacity .1s; }
      .link-row-dragging { opacity: .4; }
      .used-in-list { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
      .used-in-list li { display: flex; align-items: center; gap: 6px; font-size: 13px; background: var(--bg-panel-2); border-radius: 6px; padding: 6px 10px; }
      .link-row-over { border-color: var(--accent); }
      .link-label-input { max-width: 110px; flex-shrink: 0; }
      .icon-btn-disabled { opacity: .35; pointer-events: none; }

      .modal-overlay { position: fixed; inset: 0; background: rgba(10,8,6,.6); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
      .modal { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 14px; width: 420px; max-height: 88vh; display: flex; flex-direction: column; }
      .modal-wide { width: 560px; }
      .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
      .modal-body { padding: 18px 20px; overflow-y: auto; }
      .form { display: flex; flex-direction: column; gap: 14px; }
      .field { display: flex; flex-direction: column; gap: 5px; }
      .field-label { font-size: 12px; color: var(--text-dim); }
      .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .form-actions { display: flex; align-items: center; gap: 8px; padding-top: 6px; }
      .form-id-hint { font-size: 11.5px; color: var(--text-dim); }

      .photo-upload { height: 130px; border-radius: 10px; border: 1.5px dashed var(--border); background: var(--bg-panel-2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--text-dim); cursor: pointer; overflow: hidden; transition: border-color .15s, background .15s; }
      .photo-upload-dragging { border-color: var(--accent); background: var(--accent-tint); color: var(--accent); }
      .photo-upload { position: relative; }
      .photo-view-btn { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 7px; border: none; background: rgba(0,0,0,.55); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
      .photo-view-btn:hover { background: rgba(0,0,0,.75); }
      .lightbox-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.85); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 32px; cursor: zoom-out; }
      .lightbox-img { max-width: 100%; max-height: 100%; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,.5); cursor: default; }
      .lightbox-close { position: absolute; top: 20px; right: 20px; width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,.15); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; }
      .lightbox-close:hover { background: rgba(255,255,255,.28); }
      .photo-upload img { width: 100%; height: 100%; object-fit: cover; }
      .photo-upload span { font-size: 12.5px; }

      .cat-select { display: flex; flex-wrap: wrap; gap: 6px; }
      .cat-chip { padding: 6px 12px; border-radius: 16px; border: 1.5px solid var(--border); background: var(--bg-panel-2); font-size: 12.5px; font-weight: 500; cursor: pointer; color: var(--text-dim); }
      .cat-chip-active { border-color: transparent; color: var(--bg-panel); }
      .cat-chip.cat-aperitivo { border-color: var(--accent); color: var(--accent); }
      .cat-chip.cat-digestivo { border-color: var(--plum); color: var(--plum); }
      .cat-chip.cat-reconstituyente { border-color: var(--accent-2); color: var(--accent-2); }
      .cat-chip.cat-refrescante { border-color: var(--cool); color: var(--cool); }
      .cat-chip.cat-favorito { border-color: var(--favorite); color: var(--favorite); }
      .cat-chip.cat-aperitivo.cat-chip-active { background: var(--accent); color: var(--bg-panel); }
      .cat-chip.cat-digestivo.cat-chip-active { background: var(--plum); color: var(--bg-panel); }
      .cat-chip.cat-reconstituyente.cat-chip-active { background: var(--accent-2); color: var(--bg-panel); }
      .cat-chip.cat-refrescante.cat-chip-active { background: var(--cool); color: var(--bg-panel); }
      .cat-chip.cat-favorito.cat-chip-active { background: var(--favorite); color: var(--bg-panel); }

      .picker-row { display: flex; gap: 8px; }
      .combo { position: relative; flex: 1; min-width: 0; }
      .combo-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.25); z-index: 10; max-height: 220px; overflow-y: auto; }
      .combo-option { padding: 8px 12px; font-size: 13px; cursor: pointer; }
      .combo-option:hover { background: var(--bg-panel-2); }
      .combo-create { color: var(--accent); display: flex; align-items: center; gap: 6px; border-top: 1px solid var(--border); }
      .combo-empty { padding: 8px 12px; font-size: 12px; color: var(--text-dim); }
      .combo-hint { font-size: 11.5px; color: var(--text-dim); margin: 6px 0 0; }
      .picked-list { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
      .picked-item { background: var(--bg-panel-2); border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; border: 1.5px solid transparent; transition: border-color .1s, opacity .1s; }
      .picked-item-dragging { opacity: .4; }
      .picked-item-over { border-color: var(--accent); }
      .drag-handle { display: flex; align-items: center; color: var(--text-dim); cursor: grab; flex-shrink: 0; }
      .drag-handle:active { cursor: grabbing; }
      .picked-main, .picked-alt { display: flex; align-items: center; gap: 8px; font-size: 13px; }
      .picked-alt { padding-left: 14px; border-left: 2px solid var(--border); color: var(--text-dim); }
      .picked-amount { color: var(--text-dim); font-family: var(--font-mono); font-size: 11.5px; margin-left: auto; }
      .picked-item button { background: none; border: none; color: var(--text-dim); cursor: pointer; flex-shrink: 0; }
      .alt-tag { font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; background: var(--bg-panel); border: 1px solid var(--border); padding: 1px 6px; border-radius: 8px; color: var(--text-dim); flex-shrink: 0; }
      .add-alt-btn { align-self: flex-start; display: flex; align-items: center; gap: 4px; background: none; border: none; color: var(--accent); font-size: 11.5px; cursor: pointer; padding: 0; }
      .alt-row-edit { display: flex; align-items: center; gap: 6px; padding-left: 14px; border-left: 2px solid var(--border); }
      .alt-row-edit .combo { flex: 1; min-width: 0; }

      .detail-photo { height: 180px; margin-bottom: 14px; }
      .zoomable-image { position: relative; border-radius: 10px; overflow: hidden; cursor: pointer; }
      .zoomable-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .detail-tags { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
      .detail h4 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-dim); margin: 16px 0 6px; }
      .detail-text { font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; margin: 0; }
      .markdown-body { font-size: 13.5px; line-height: 1.6; }
      .markdown-body p { margin: 0 0 8px; }
      .markdown-body p:last-child { margin-bottom: 0; }
      .markdown-body ul, .markdown-body ol { margin: 0 0 8px; padding-left: 20px; }
      .markdown-body li { margin-bottom: 3px; }
      .markdown-body h3, .markdown-body h4, .markdown-body h5 { font-family: var(--font-display); font-weight: 500; margin: 12px 0 4px; }
      .markdown-body h3:first-child, .markdown-body h4:first-child, .markdown-body h5:first-child { margin-top: 0; }
      .markdown-body strong { color: var(--text); font-weight: 600; }
      .markdown-body code { background: var(--bg-panel-2); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; font-family: var(--font-mono); font-size: 12px; }
      .markdown-body .md-img { max-width: 100%; border-radius: 8px; margin: 6px 0; display: block; border: 1px solid var(--border); }
      .detail-ing-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
      .detail-ing-list li { font-size: 13.5px; padding: 6px 10px; background: var(--bg-panel-2); border-radius: 6px; display: flex; flex-direction: column; gap: 3px; }
      .detail-ing-list li > div:first-child { display: flex; justify-content: space-between; }
      .detail-ing-missing { color: var(--danger); }
      .missing-tag { font-size: 11px; font-family: var(--font-mono); }
      .detail-alt-line { font-size: 12px; color: var(--text-dim); padding-left: 10px; }
      .alt-in-use { color: var(--accent-2); font-weight: 500; }
      .detail-times { font-size: 12px; color: var(--text-dim); margin-top: 14px; }

      .badge { font-size: 11px; padding: 3px 9px; border-radius: 10px; background: var(--bg-panel-2); border: 1px solid var(--border); color: var(--text-dim); }
      .badge-success { background: var(--accent-2); color: var(--bg-panel); border-color: transparent; }
      .badge-danger { background: var(--danger); color: var(--bg-panel); border-color: transparent; }
      .badge-info { background: var(--cool); color: var(--bg-panel); border-color: transparent; }


      .suggestions-block { margin-bottom: 22px; }
      .suggestions-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
      .suggestion-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 9px; padding: 10px 14px; }
      .suggestion-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .suggestion-name { font-size: 13.5px; font-weight: 500; }
      .suggestion-detail { font-size: 11.5px; color: var(--text-dim); }
      .add-item-row { display: flex; gap: 8px; margin-bottom: 18px; max-width: 480px; }
      .shop-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
      .shop-row { display: flex; align-items: center; gap: 10px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 9px; padding: 9px 12px; }
      .shop-row-checked { opacity: .5; }
      .checkbox { width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--border); background: none; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--bg-panel); }
      .checkbox-checked { background: var(--accent-2); border-color: var(--accent-2); }
      .shop-info { flex: 1; display: flex; flex-direction: column; font-size: 13.5px; }
      .shop-source { font-size: 11px; color: var(--text-dim); }
      .shop-amount { font-family: var(--font-mono); font-size: 12px; color: var(--text-dim); }

      .theme-toggle { display: flex; gap: 8px; }
      .theme-opt { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-panel-2); cursor: pointer; font-size: 13px; }
      .theme-opt-active { border-color: var(--accent); color: var(--accent); }

      .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--text); color: var(--bg); padding: 10px 18px; border-radius: 8px; font-size: 13px; z-index: 100; display: flex; align-items: center; gap: 14px; }
      .toast-action { background: none; border: none; color: var(--accent); font-weight: 600; font-size: 13px; cursor: pointer; padding: 0; white-space: nowrap; }

      .auth-app { display: flex; align-items: center; justify-content: center; min-height: 560px; }
      .auth-screen { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 40px 20px; width: 100%; }
      .auth-brand { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-size: 19px; color: var(--accent); }
      .auth-card { width: 320px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 14px; padding: 22px; }
      .auth-tabs { display: flex; gap: 4px; background: var(--bg-panel-2); border-radius: 8px; padding: 3px; margin-bottom: 18px; }
      .auth-tabs button { flex: 1; padding: 7px; border: none; background: none; border-radius: 6px; font-size: 12.5px; color: var(--text-dim); cursor: pointer; }
      .auth-tab-active { background: var(--accent) !important; color: var(--bg-panel) !important; }
      .input-icon { display: flex; align-items: center; gap: 8px; background: var(--bg-panel-2); border: 1px solid var(--border); border-radius: 7px; padding: 0 10px; color: var(--text-dim); }
      .input-icon input { border: none; background: none; padding: 8px 0; }
      .auth-error { color: var(--danger); font-size: 12.5px; margin: 0; }
      .pw-success { color: var(--accent-2); font-size: 12.5px; margin: 0; }

      @media (max-width: 720px) {
        .app { flex-direction: column; }
        .sidebar { width: 100%; flex-direction: row; overflow-x: auto; padding: 10px; border-right: none; border-bottom: 1px solid var(--border); }
        .brand { display: none; }
        .navbtn { flex-direction: column; gap: 3px; font-size: 10px; padding: 6px 12px; }
        .navbtn-label { flex: none; }
        .navbtn-badge { position: absolute; top: 2px; right: 2px; }
        .sidebar-user { border-top: none; }
        .main { padding: 18px; max-height: none; }
        .panel-row { grid-template-columns: 1fr; }
        .modal { width: 100%; }
      }
    `}</style>
  );
}
