import React from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

export default function DashboardTab({ recipes, ingredients, categories, availableCount }) {
  const totalMade = recipes.reduce((s, r) => s + (r.timesMade || 0), 0);
  const topRecipes = [...recipes].sort((a, b) => (b.timesMade || 0) - (a.timesMade || 0)).slice(0, 5);

  const usage = {};
  recipes.forEach((r) => {
    const weight = r.timesMade || 0;
    r.mainIngredients.forEach((mi) => {
      const key = mi.categoryId ? `cat:${mi.categoryId}` : `ing:${mi.ingredientId}`;
      usage[key] = (usage[key] || 0) + Math.max(1, weight);
    });
  });
  const topIngredients = Object.entries(usage)
    .map(([key, count]) => {
      const id = key.slice(4);
      let name;
      if (key.startsWith("cat:")) {
        const cat = (categories || []).find((c) => c.id === id);
        name = cat ? cat.name : "Categoría eliminada";
      } else {
        const ing = ingredients.find((i) => i.id === id);
        name = ing ? ing.name : "Ingrediente eliminado";
      }
      return { name, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <div>
      <header className="page-header"><h1>Métricas</h1><p className="page-sub">El pulso de la barra.</p></header>
      <div className="metric-grid">
        <div className="metric-card"><span className="metric-label">Recetas disponibles</span><span className="metric-value">{availableCount}</span></div>
        <div className="metric-card"><span className="metric-label">Recetas totales</span><span className="metric-value">{recipes.length}</span></div>
        <div className="metric-card"><span className="metric-label">Ingredientes en inventario</span><span className="metric-value">{ingredients.length}</span></div>
        <div className="metric-card"><span className="metric-label">Cócteles servidos</span><span className="metric-value">{totalMade}</span></div>
      </div>
      <div className="panel-row">
        <div className="panel">
          <h3 className="panel-title">Recetas más servidas</h3>
          {topRecipes.filter((r) => r.timesMade).length === 0 ? (
            <p className="empty-body">Todavía no has marcado ninguna receta como servida.</p>
          ) : (
            <ul className="rank-list">
              {topRecipes.filter((r) => r.timesMade).map((r, idx) => (
                <li key={r.id}><span className="rank-num">{idx + 1}</span><span className="rank-name">{r.name}</span><span className="rank-count">{r.timesMade}×</span></li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel">
          <h3 className="panel-title">Ingredientes más usados</h3>
          {topIngredients.length === 0 ? (
            <p className="empty-body">Añade recetas para ver estadísticas de uso.</p>
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={topIngredients} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fill: "var(--text-dim)", fontSize: 12, fontFamily: "var(--font-body)" }} axisLine={false} tickLine={false} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>{topIngredients.map((_, i) => <Cell key={i} fill="var(--accent)" />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
