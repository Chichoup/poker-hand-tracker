# ♠ Poker Hand Tracker

Web app premium para trackear sesiones de poker — reemplaza y supera el Google Sheets de tracking.
Multi-usuario, datos persistentes en base de datos real, lista para Vercel.

---

## 1. Arquitectura (por qué así)

**Supabase (Auth + PostgreSQL) + sitio estático HTML/CSS/JS vanilla + Chart.js, deployado en Vercel.**
Es gratis, sin servidor propio que mantener, y el aislamiento por usuario lo garantiza **Row Level Security** de Postgres (cada query solo devuelve `auth.uid() = user_id`). Sin build tools: Vercel sirve los archivos tal cual, así que el deploy es instantáneo y la `anon key` —pública por diseño— se carga en el cliente sin riesgo porque RLS bloquea el acceso cruzado entre usuarios.

---

## 2. Schema SQL

Está en [`schema.sql`](schema.sql). En Supabase: **SQL Editor → New query**, pegá todo el archivo y **Run**.
Crea dos tablas (`configs`, `sessions`) con RLS activado y políticas “solo lo mío”. El campo `result` es una **columna generada** (`cashout - buyin`), así que el cálculo es atómico en la DB.

---

## 3. Variables de entorno

Ver [`.env.example`](.env.example). Son dos valores **públicos** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
En este proyecto estático se cargan en [`assets/js/config.js`](assets/js/config.js) — editá ese archivo con los datos de tu proyecto (Supabase → *Project Settings → API*).

---

## 4. Deploy en Vercel (paso a paso)

1. Creá un proyecto en [supabase.com](https://supabase.com) (plan free).
2. **SQL Editor** → pegá `schema.sql` → **Run**.
3. **Project Settings → API** → copiá *Project URL* y *anon public key*.
4. Pegá esos dos valores en `assets/js/config.js`.
5. (Opcional, recomendado) **Authentication → Providers → Email**: desactivá *Confirm email* para que el alta sea inmediata en el curso.
6. Subí esta carpeta a un repo de GitHub.
7. En [vercel.com](https://vercel.com) → **Add New → Project** → importá el repo.
8. Framework Preset: **Other** (no hace falta build). Deploy.
9. Abrí la URL, registrate y empezá a cargar sesiones. ✅

> También podés arrastrar la carpeta en **vercel.com/new** (deploy sin Git).

### Datos de ejemplo (opcional)
Para ver los dashboards llenos sin cargar a mano: editá el email en [`seed.sql`](seed.sql) (poné el tuyo) y corrélo en el **SQL Editor**. Carga 14 sesiones realistas (mayo + junio 2026) y es re-ejecutable.

---

## 5. Estructura del código

```
index.html            UI + shell (auth + app)
schema.sql            tablas + RLS para Supabase
assets/css/styles.css design system dark premium
assets/js/config.js   credenciales Supabase (editar)
assets/js/calc.js     LÓGICA de cálculo (réplica del Excel, funciones puras)
assets/js/db.js       DATOS (auth + CRUD aislado por usuario)
assets/js/app.js      RENDER + eventos + charts
```

Separación clara: **datos** (`db.js`) · **cálculo** (`calc.js`) · **render** (`app.js`).

---

## 6. Funcionalidad (paridad con el Excel + mejoras)

- 🏠 **Inicio** · KPIs del mes + progreso de objetivos.
- 📝 **Registro** · alta/edición/borrado, `Resultado = Cash-out − Buy-in`, bankroll en cascada, mood 1-5, búsqueda y filtros, **export CSV**.
- 📊 **Dashboard** · P&L, $/h total/live/online, % ganadas, mejor/peor sesión y racha, stake más jugado, **gráfico de bankroll**, **P&L por stake**, **distribución de mood**, **BB/100**.
- 📅 **Análisis mensual** · selector de mes que filtra todo.
- 🎯 **Objetivos** · horas, sesiones, estudio y manos: meta/real/delta/barra animada.
- 🧠 **Mental Game** · mood promedio, mood en ganadoras vs perdedoras, %A-Game, %Tilt, P&L y $/h por mood + insight automático.
- ⚙️ **Config** · perfil, moneda, bankroll inicial, objetivos y BB sizes — alimenta todos los cálculos.
