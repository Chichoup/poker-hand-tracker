-- ============================================================
--  Poker Hand Tracker — DATOS DE EJEMPLO (seed)
--  Cargá sesiones realistas para ver todos los dashboards.
--
--  PASOS:
--   1) Registrate en la app (o creá el usuario en Supabase → Authentication).
--   2) Cambiá el email de abajo por el tuyo.
--   3) Pegá todo en Supabase → SQL Editor → Run.
--
--  Es re-ejecutable: borra el seed anterior (notas con '[seed]') antes de
--  insertar. NO toca sesiones que hayas cargado a mano.
-- ============================================================

DO $$
DECLARE
  uid uuid;
  v_email text := 'agustinnvarela@gmail.com';   -- 👈 CAMBIÁ ESTE EMAIL
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = v_email;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario con email %. Registrate primero en la app.', v_email;
  END IF;

  -- Config del jugador (upsert)
  INSERT INTO public.configs (user_id, name, currency, initial_bankroll,
                              goal_hours, goal_sessions, goal_study, goal_hands, usual_stake)
  VALUES (uid, 'Chicho', 'USD', 2000, 40, 20, 10, 200, '1/3')
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name, currency = EXCLUDED.currency,
    initial_bankroll = EXCLUDED.initial_bankroll, goal_hours = EXCLUDED.goal_hours,
    goal_sessions = EXCLUDED.goal_sessions, goal_study = EXCLUDED.goal_study,
    goal_hands = EXCLUDED.goal_hands, usual_stake = EXCLUDED.usual_stake;

  -- Limpia seed previo
  DELETE FROM public.sessions WHERE user_id = uid AND notes LIKE '%[seed]%';

  -- Sesiones: (fecha, modalidad, sitio, stakes, horas, buyin, cashout, mood, estudio, manos, notas)
  INSERT INTO public.sessions
    (user_id, played_on, mode, site, stakes, hours, buyin, cashout, mood, study_hours, hands_analyzed, notes)
  VALUES
  -- ===== Mes anterior: 2026-05 =====
  (uid,'2026-05-03','Live','Casino Buenos Aires','1/3',5.0,300,520,4,1.0,20,'Buen día, value claro [seed]'),
  (uid,'2026-05-06','Online','PokerStars','NL50',2.5,100,38,2,0.5,40,'Tilt leve tras bad beat [seed]'),
  (uid,'2026-05-10','Live','Casino Buenos Aires','1/3',6.0,300,180,3,0.0,0,'Sesión floja, mazo seco [seed]'),
  (uid,'2026-05-14','Online','GGPoker','NL100',3.0,200,415,5,2.0,80,'A-Game total, run + juego sólido [seed]'),
  (uid,'2026-05-18','Live','Club Privado','2/5',7.0,500,780,4,0.5,15,'Mesa muy débil, presioné spots [seed]'),
  (uid,'2026-05-22','Online','PokerStars','NL50',2.0,100,86,3,1.0,50,'Neutral, breakeven-ish [seed]'),
  (uid,'2026-05-27','Live','Casino Buenos Aires','1/3',4.5,300,140,1,0.0,0,'No debí jugar, cansado [seed]'),
  (uid,'2026-05-30','Online','GGPoker','NL100',3.5,200,330,4,1.5,70,'Foco alto, buenas decisiones [seed]'),

  -- ===== Mes actual: 2026-06 =====
  (uid,'2026-06-02','Live','Casino Buenos Aires','1/3',5.5,300,640,5,1.0,25,'A-Game, racha de coolers a favor [seed]'),
  (uid,'2026-06-05','Online','PokerStars','NL50',2.0,100,150,4,0.5,45,'Sólido, buen run de showdowns [seed]'),
  (uid,'2026-06-08','Live','Club Privado','2/5',6.5,500,395,2,0.0,0,'Frustrado, jugué pasivo [seed]'),
  (uid,'2026-06-11','Online','GGPoker','NL100',3.0,200,288,3,2.0,90,'OK, sesión pareja [seed]'),
  (uid,'2026-06-13','Live','Casino Buenos Aires','1/3',4.0,300,560,4,1.0,20,'Buen estado, value thin pagado [seed]'),
  (uid,'2026-06-15','Online','PokerStars','NL200',2.5,400,250,1,0.5,30,'Tilt feo, perseguí pérdidas [seed]');

  RAISE NOTICE 'Seed cargado para % (14 sesiones).', v_email;
END $$;
