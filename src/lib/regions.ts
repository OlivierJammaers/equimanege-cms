/**
 * Regiocatalogus voor de AI-crawlpijplijn (fase 3): land + provincie/regio
 * die een admin kan kiezen om te laten onderzoeken. Puur statische data,
 * geen I/O. Zie docs/superpowers/plans/2026-09-03-fase3-ai-crawl.md
 * onder "Regiocatalogus".
 */

export type Country = "BE" | "NL" | "DE" | "FR";

export type Region = {
  country: Country;
  code: string;
  name: string;
};

export const COUNTRY_LABELS: Record<Country, string> = {
  BE: "België",
  NL: "Nederland",
  DE: "Duitsland",
  FR: "Frankrijk",
};

/**
 * BE: 10 provincies + Brussels Hoofdstedelijk Gewest.
 * NL: 12 provincies.
 * DE: 16 Bundesländer.
 * FR: 13 régions métropolitaines (geen overzeese gebieden).
 */
export const REGIONS: Region[] = [
  // BE — 10 provincies + Brussels Hoofdstedelijk Gewest (11)
  { country: "BE", code: "BE-VAN", name: "Antwerpen" },
  { country: "BE", code: "BE-VLI", name: "Limburg" },
  { country: "BE", code: "BE-VOV", name: "Oost-Vlaanderen" },
  { country: "BE", code: "BE-VBR", name: "Vlaams-Brabant" },
  { country: "BE", code: "BE-VWV", name: "West-Vlaanderen" },
  { country: "BE", code: "BE-WBR", name: "Waals-Brabant" },
  { country: "BE", code: "BE-WHT", name: "Henegouwen" },
  { country: "BE", code: "BE-WLG", name: "Luik" },
  { country: "BE", code: "BE-WLX", name: "Luxemburg" },
  { country: "BE", code: "BE-WNA", name: "Namen" },
  { country: "BE", code: "BE-BRU", name: "Brussels Hoofdstedelijk Gewest" },

  // NL — 12 provincies
  { country: "NL", code: "NL-GR", name: "Groningen" },
  { country: "NL", code: "NL-FR", name: "Friesland" },
  { country: "NL", code: "NL-DR", name: "Drenthe" },
  { country: "NL", code: "NL-OV", name: "Overijssel" },
  { country: "NL", code: "NL-FL", name: "Flevoland" },
  { country: "NL", code: "NL-GE", name: "Gelderland" },
  { country: "NL", code: "NL-UT", name: "Utrecht" },
  { country: "NL", code: "NL-NH", name: "Noord-Holland" },
  { country: "NL", code: "NL-ZH", name: "Zuid-Holland" },
  { country: "NL", code: "NL-ZE", name: "Zeeland" },
  { country: "NL", code: "NL-NB", name: "Noord-Brabant" },
  { country: "NL", code: "NL-LI", name: "Limburg" },

  // DE — 16 Bundesländer
  { country: "DE", code: "DE-BW", name: "Baden-Württemberg" },
  { country: "DE", code: "DE-BY", name: "Bayern" },
  { country: "DE", code: "DE-BE", name: "Berlin" },
  { country: "DE", code: "DE-BB", name: "Brandenburg" },
  { country: "DE", code: "DE-HB", name: "Bremen" },
  { country: "DE", code: "DE-HH", name: "Hamburg" },
  { country: "DE", code: "DE-HE", name: "Hessen" },
  { country: "DE", code: "DE-MV", name: "Mecklenburg-Vorpommern" },
  { country: "DE", code: "DE-NI", name: "Niedersachsen" },
  { country: "DE", code: "DE-NW", name: "Nordrhein-Westfalen" },
  { country: "DE", code: "DE-RP", name: "Rheinland-Pfalz" },
  { country: "DE", code: "DE-SL", name: "Saarland" },
  { country: "DE", code: "DE-SN", name: "Sachsen" },
  { country: "DE", code: "DE-ST", name: "Sachsen-Anhalt" },
  { country: "DE", code: "DE-SH", name: "Schleswig-Holstein" },
  { country: "DE", code: "DE-TH", name: "Thüringen" },

  // FR — 13 régions métropolitaines
  { country: "FR", code: "FR-ARA", name: "Auvergne-Rhône-Alpes" },
  { country: "FR", code: "FR-BFC", name: "Bourgogne-Franche-Comté" },
  { country: "FR", code: "FR-BRE", name: "Bretagne" },
  { country: "FR", code: "FR-CVL", name: "Centre-Val de Loire" },
  { country: "FR", code: "FR-COR", name: "Corse" },
  { country: "FR", code: "FR-GES", name: "Grand Est" },
  { country: "FR", code: "FR-HDF", name: "Hauts-de-France" },
  { country: "FR", code: "FR-IDF", name: "Île-de-France" },
  { country: "FR", code: "FR-NOR", name: "Normandie" },
  { country: "FR", code: "FR-NAQ", name: "Nouvelle-Aquitaine" },
  { country: "FR", code: "FR-OCC", name: "Occitanie" },
  { country: "FR", code: "FR-PDL", name: "Pays de la Loire" },
  { country: "FR", code: "FR-PAC", name: "Provence-Alpes-Côte d'Azur" },
];
