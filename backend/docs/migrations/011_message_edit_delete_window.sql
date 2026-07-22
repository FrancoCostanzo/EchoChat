-- =============================================================================
-- MIGRACIÓN 011 — Ventana de tiempo para editar/eliminar mensajes propios
--
-- Por defecto 15 minutos (estilo WhatsApp). 0 = sin límite.
-- Idempotente.
-- =============================================================================

INSERT INTO system_settings (key, value, description, category) VALUES
    ('message_edit_window_minutes', '15',
     'Minutos para editar un mensaje propio (0 = sin límite)', 'messages'),
    ('message_delete_window_minutes', '15',
     'Minutos para eliminar un mensaje propio (0 = sin límite)', 'messages')
ON CONFLICT (key) DO NOTHING;
