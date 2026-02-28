export interface BookSearchListItemDto {
  titulo: string;
  autor: string;
  imagen: string | null;
  externalId: string | null;
}

export interface BookSearchDetailDto {
  titulo: string;
  autor: string;
  idioma: "Español" | "Inglés" | "Otro";
  isbn: string | null;
  anio: string | null;
  editorial: string | null;
  imagen: string | null;
}

export interface BookEditionDto {
  edicionId: string | null;
  idioma: "Español" | "Inglés" | "Otro";
  isbn: string | null;
  anio: string | null;
  editorial: string | null;
  imagen: string | null;
}