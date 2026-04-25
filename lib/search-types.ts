export type SearchEntry = {
  id: string;
  slug: string;
  title: string;
  section: string;
  route: string;
  anchor: string;
  description: string;
  snippet: string;
  searchText: string;
  kind: "page" | "section";
};

export type SearchSource = {
  id: string;
  title: string;
  section: string;
  route: string;
  anchor: string;
  snippet: string;
};
