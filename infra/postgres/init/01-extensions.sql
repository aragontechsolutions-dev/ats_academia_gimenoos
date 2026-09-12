-- Extensiones necesarias para el motor de agenda.
-- btree_gist permite combinar igualdad (=) sobre uuid con solapamiento (&&) sobre rangos
-- dentro de una misma EXCLUDE constraint. Sin esto, la proteccion anti-doble-reserva no compila.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
