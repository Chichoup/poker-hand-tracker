-- Ejecutar en Supabase SQL Editor
CREATE TABLE IF NOT EXISTS hands (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid REFERENCES auth.users NOT NULL,
  played_on      date NOT NULL DEFAULT CURRENT_DATE,
  stakes         text DEFAULT '',
  hero_position  text DEFAULT '',
  hero_cards     text DEFAULT '',
  players        jsonb DEFAULT '[]',
  preflop        text DEFAULT '',
  flop_board     text DEFAULT '',
  flop_action    text DEFAULT '',
  turn_card      text DEFAULT '',
  turn_action    text DEFAULT '',
  river_card     text DEFAULT '',
  river_action   text DEFAULT '',
  result_notes   text DEFAULT '',
  notes          text DEFAULT '',
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE hands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own hands" ON hands;
CREATE POLICY "own hands" ON hands FOR ALL USING (auth.uid() = user_id);
