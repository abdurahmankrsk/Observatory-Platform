/**
 * i18n — Lightweight translation layer.
 *
 * The active language lives in the Zustand store (`language`), so components
 * re-render automatically when it changes. Use the `useTranslation` hook:
 *
 *     const { t } = useTranslation()
 *     <p>{t('search.popular')}</p>
 *     <p>{t('coord.found', { name: obj.name })}</p>   // {name} interpolation
 *
 * Only UI chrome is translated. Live data from the backend (object names,
 * descriptions, fun facts) and scientific units (ly, AU, K, R⊕…) stay as-is.
 */
import useObservatoryStore from '../store/observatoryStore'

export const LANGUAGES = [
  { code: 'en', label: 'English', flag: 'gb' },
  { code: 'bs', label: 'Bosanski', flag: 'ba' },
]

const en = {
  // StartScreen
  'start.status': 'SYSTEM ONLINE · COORDINATES LOCKED',
  'start.subtitle1': 'Explore exoplanets, stars, nebulae, asteroids, black holes and other celestial objects!',
  'start.subtitle2': 'Powered by real NASA data & the SIMBAD database',
  'start.enter': 'ENTER OBSERVATORY',

  // SearchPanel
  'search.title': 'SEARCH OBJECT',
  'search.placeholder': 'Andromeda, Sirius, Saturn, Bennu...',
  'search.results': 'RESULTS ({count})',
  'search.popular': 'POPULAR OBJECTS',
  'search.failed': 'Search failed. Check your connection.',
  'search.pressEnter': 'Press Enter to search.',
  'search.noResults': 'No results found.',
  'search.action': 'Search',
  'search.actionHint': 'Search (Enter)',
  'search.saved': 'SAVED OBJECTS',
  'search.save': 'Save object',
  'search.unsave': 'Remove from saved',

  // CoordinateInput
  'coord.title': 'COORDINATE INPUT',
  'coord.raLabel': 'RA (0 – 360°)',
  'coord.decLabel': 'Dec (-90 – +90°)',
  'coord.raError': 'RA must be 0–360°',
  'coord.decError': 'Dec must be -90 to +90°',
  'coord.found': 'Found: {name}',
  'coord.foundAway': 'Found: {name} ({deg}° away)',
  'coord.noObject': 'No catalogued object within {deg}° — showing empty field.',
  'coord.lookupFailed': 'Lookup failed — showing empty field.',
  'coord.identifying': 'IDENTIFYING…',
  'coord.point': 'POINT TELESCOPE',
  'coord.customDesc': 'A custom sky coordinate entered by the observer.',

  // InfoPanel — data labels
  'info.radius': 'RADIUS',
  'info.mass': 'MASS',
  'info.orbitalPeriod': 'ORBITAL PERIOD',
  'info.semiMajorAxis': 'SEMI-MAJOR AXIS',
  'info.equilibriumTemp': 'EQUILIBRIUM TEMP',
  'info.starTemp': 'STAR TEMP',
  'info.habitableZone': 'HABITABLE ZONE',
  'info.possibly': '✓ POSSIBLY',
  'info.unlikely': '✗ UNLIKELY',
  'info.spectralClass': 'SPECTRAL CLASS',
  'info.temperature': 'TEMPERATURE',
  'info.luminosity': 'LUMINOSITY',
  'info.diameter': 'DIAMETER',
  'info.hazardous': 'HAZARDOUS',
  'info.yes': '⚠ YES',
  'info.no': 'NO',
  'info.missDistance': 'MISS DISTANCE',
  'info.velocity': 'VELOCITY',
  'info.approachDate': 'APPROACH DATE',
  'info.ra': 'RA',
  'info.dec': 'DEC',
  'info.days': 'days',
  'info.didYouKnow': 'DID YOU KNOW',
  'info.flyTo': 'FLY TO {name}',
  'info.back': 'BACK TO OBSERVATORY',
  'info.save': '☆ SAVE OBJECT',
  'info.saved': '★ SAVED',

  // OcularView
  'ocular.seeing': 'ATMOSPHERIC SEEING: GOOD',

  // LoadingScreen — warp status (cycled in order)
  'warp.0': 'CALCULATING TRAJECTORY...',
  'warp.1': 'ENGAGING WARP DRIVE...',
  'warp.2': 'CROSSING INTERSTELLAR VOID...',
  'warp.3': 'APPROACHING TARGET SYSTEM...',
  'warp.4': 'DECELERATING...',
  'warp.5': 'ACHIEVING STABLE ORBIT...',

  // App — errors, HUD
  'app.sceneError': '3D SCENE ERROR',
  'app.sceneErrorDesc': 'Your device may not support WebGL, or the 3D scene encountered an error.',
  'app.unknownError': 'Unknown error',
  'app.reload': 'RELOAD',
  'app.webglRequired': 'AstroObservatory requires WebGL support to render 3D scenes. Please use a modern browser (Chrome, Firefox, Edge, or Safari 15+).',
  'app.rotationOn': 'ROTATION: ON',
  'app.rotationOff': 'ROTATION: OFF',

  // Scene indicator (top-right HUD)
  'scene.entering': 'ENTERING',
  'scene.observatory': 'OBSERVATORY',
  'scene.targeting': 'TARGETING',
  'scene.flying': 'FLYING',
  'scene.viewing': 'VIEWING',
}

const bs = {
  // StartScreen
  'start.status': 'SISTEM AKTIVAN · KOORDINATE ZAKLJUČANE',
  'start.subtitle1': 'Istražite egzoplanete, zvijezde, maglice, asteroide, crne rupe i ostala nebeska tijela!',
  'start.subtitle2': 'pokretano stvarnim NASA podacima',
  'start.enter': 'UĐITE U OPSERVATORIJ',
  
  // SearchPanel
  'search.title': 'PRETRAŽI OBJEKT',
  'search.placeholder': 'Andromeda, Sirius, Saturn, Bennu...',
  'search.results': 'REZULTATI ({count})',
  'search.popular': 'POPULARNI OBJEKTI',
  'search.failed': 'Pretraga nije uspjela. Provjerite vezu.',
  'search.pressEnter': 'Pritisnite Enter za pretragu.',
  'search.noResults': 'Nema pronađenih rezultata.',
  'search.action': 'Pretraga',
  'search.actionHint': 'Pretraga (Enter)',
  'search.saved': 'SAČUVANI OBJEKTI',
  'search.save': 'Sačuvaj objekt',
  'search.unsave': 'Ukloni iz sačuvanih',

  // CoordinateInput
  'coord.title': 'UNOS KOORDINATA',
  'coord.raLabel': 'RA (0 – 360°)',
  'coord.decLabel': 'Dec (-90 – +90°)',
  'coord.raError': 'RA mora biti 0–360°',
  'coord.decError': 'Dec mora biti -90 do +90°',
  'coord.found': 'Pronađeno: {name}',
  'coord.foundAway': 'Pronađeno: {name} ({deg}° udaljeno)',
  'coord.noObject': 'Nema kataloškog objekta unutar {deg}° — prikazujem prazno polje.',
  'coord.lookupFailed': 'Pretraga nije uspjela — prikazujem prazno polje.',
  'coord.identifying': 'IDENTIFIKACIJA…',
  'coord.point': 'USMJERI TELESKOP',
  'coord.customDesc': 'Prilagođena nebeska koordinata koju je unio posmatrač.',

  // InfoPanel — data labels
  'info.radius': 'RADIJUS',
  'info.mass': 'MASA',
  'info.orbitalPeriod': 'ORBITALNI PERIOD',
  'info.semiMajorAxis': 'VELIKA POLUOSA',
  'info.equilibriumTemp': 'RAVNOTEŽNA TEMP.',
  'info.starTemp': 'TEMP. ZVIJEZDE',
  'info.habitableZone': 'NASTANJIVA ZONA',
  'info.possibly': '✓ MOGUĆE',
  'info.unlikely': '✗ MALO VJEROVATNO',
  'info.spectralClass': 'SPEKTRALNA KLASA',
  'info.temperature': 'TEMPERATURA',
  'info.luminosity': 'LUMINOZITET',
  'info.diameter': 'PREČNIK',
  'info.hazardous': 'OPASAN',
  'info.yes': '⚠ DA',
  'info.no': 'NE',
  'info.missDistance': 'NAJMANJA UDALJENOST',
  'info.velocity': 'BRZINA',
  'info.approachDate': 'DATUM PRILASKA',
  'info.ra': 'RA',
  'info.dec': 'DEC',
  'info.days': 'dana',
  'info.didYouKnow': 'DA LI STE ZNALI',
  'info.flyTo': 'LETI DO {name}',
  'info.back': 'NAZAD U OPSERVATORIJ',
  'info.save': '☆ SAČUVAJ OBJEKT',
  'info.saved': '★ SAČUVANO',

  // OcularView
  'ocular.seeing': 'ATMOSFERSKO VIĐENJE: DOBRO',

  // LoadingScreen — warp status (cycled in order)
  'warp.0': 'IZRAČUNAVANJE PUTANJE...',
  'warp.1': 'AKTIVIRANJE WARP POGONA...',
  'warp.2': 'PRELAZAK MEĐUZVJEZDANE PRAZNINE...',
  'warp.3': 'PRIBLIŽAVANJE CILJNOM SISTEMU...',
  'warp.4': 'USPORAVANJE...',
  'warp.5': 'POSTIZANJE STABILNE ORBITE...',

  // App — errors, HUD
  'app.sceneError': 'GREŠKA 3D SCENE',
  'app.sceneErrorDesc': 'Vaš uređaj možda ne podržava WebGL, ili je 3D scena naišla na grešku.',
  'app.unknownError': 'Nepoznata greška',
  'app.reload': 'PONOVO UČITAJ',
  'app.webglRequired': 'AstroObservatory zahtijeva podršku za WebGL za prikaz 3D scena. Molimo koristite moderan preglednik (Chrome, Firefox, Edge ili Safari 15+).',
  'app.rotationOn': 'ROTACIJA: UKLJUČENA',
  'app.rotationOff': 'ROTACIJA: ISKLJUČENA',

  // Scene indicator (top-right HUD)
  'scene.entering': 'ULAZAK',
  'scene.observatory': 'OPSERVATORIJ',
  'scene.targeting': 'CILJANJE',
  'scene.flying': 'LET',
  'scene.viewing': 'PREGLED',
}

export const translations = { en, bs }

/**
 * Object-type labels for badges. Keyed by BOTH the coarse backend type
 * (lowercase: 'planet', 'star', 'galaxy'…) used by SearchPanel and the fine
 * CelestialType enum value (PascalCase: 'BlackHole', 'SpiralGalaxy'…) emitted by
 * the classifier and shown on the InfoPanel badge. `.badge` CSS uppercases these.
 */
const typeLabels = {
  en: {
    // coarse (backend)
    planet: 'Planet', exoplanet: 'Exoplanet', moon: 'Moon', asteroid: 'Asteroid',
    comet: 'Comet', star: 'Star', blackhole: 'Black Hole', nebula: 'Nebula',
    galaxy: 'Galaxy', unknown: 'Unknown',
    // fine (CelestialType)
    Planet: 'Planet', Exoplanet: 'Exoplanet', Moon: 'Moon', Asteroid: 'Asteroid', Comet: 'Comet',
    Star: 'Star', MainSequenceStar: 'Main Sequence Star', RedGiant: 'Red Giant',
    RedSupergiant: 'Red Supergiant', BlueGiant: 'Blue Giant', WhiteDwarf: 'White Dwarf',
    BrownDwarf: 'Brown Dwarf', NeutronStar: 'Neutron Star', Pulsar: 'Pulsar', Magnetar: 'Magnetar',
    BlackHole: 'Black Hole', Protostar: 'Protostar',
    Galaxy: 'Galaxy', SpiralGalaxy: 'Spiral Galaxy', EllipticalGalaxy: 'Elliptical Galaxy',
    IrregularGalaxy: 'Irregular Galaxy',
    Nebula: 'Nebula', PlanetaryNebula: 'Planetary Nebula', EmissionNebula: 'Emission Nebula',
    ReflectionNebula: 'Reflection Nebula', DarkNebula: 'Dark Nebula',
    GlobularCluster: 'Globular Cluster', OpenCluster: 'Open Cluster',
    SupernovaRemnant: 'Supernova Remnant', Quasar: 'Quasar', BinaryStar: 'Binary Star',
    Unknown: 'Unknown',
  },
  bs: {
    // coarse (backend)
    planet: 'Planeta', exoplanet: 'Egzoplaneta', moon: 'Mjesec', asteroid: 'Asteroid',
    comet: 'Komet', star: 'Zvijezda', blackhole: 'Crna rupa', nebula: 'Maglica',
    galaxy: 'Galaksija', unknown: 'Nepoznato',
    // fine (CelestialType)
    Planet: 'Planeta', Exoplanet: 'Egzoplaneta', Moon: 'Mjesec', Asteroid: 'Asteroid', Comet: 'Komet',
    Star: 'Zvijezda', MainSequenceStar: 'Zvijezda glavnog niza', RedGiant: 'Crveni div',
    RedSupergiant: 'Crveni superdiv', BlueGiant: 'Plavi div', WhiteDwarf: 'Bijeli patuljak',
    BrownDwarf: 'Smeđi patuljak', NeutronStar: 'Neutronska zvijezda', Pulsar: 'Pulsar', Magnetar: 'Magnetar',
    BlackHole: 'Crna rupa', Protostar: 'Protozvijezda',
    Galaxy: 'Galaksija', SpiralGalaxy: 'Spiralna galaksija', EllipticalGalaxy: 'Eliptična galaksija',
    IrregularGalaxy: 'Nepravilna galaksija',
    Nebula: 'Maglica', PlanetaryNebula: 'Planetarna maglica', EmissionNebula: 'Emisiona maglica',
    ReflectionNebula: 'Refleksiona maglica', DarkNebula: 'Tamna maglica',
    GlobularCluster: 'Globularno jato', OpenCluster: 'Otvoreno jato',
    SupernovaRemnant: 'Ostatak supernove', Quasar: 'Kvazar', BinaryStar: 'Dvojna zvijezda',
    Unknown: 'Nepoznato',
  },
}

/**
 * Translate a celestial-object type to a display label.
 * Accepts coarse ('planet') or fine ('SpiralGalaxy') types. Falls back to a
 * PascalCase-split of the raw value so an unmapped type still reads cleanly.
 */
export function translateType(lang, type) {
  if (!type) return (typeLabels[lang] || typeLabels.en).unknown
  const dict = typeLabels[lang] || typeLabels.en
  return dict[type] || typeLabels.en[type] || String(type).replace(/([a-z])([A-Z])/g, '$1 $2')
}

/**
 * Resolve a key for a given language with {var} interpolation.
 * Falls back to English, then to the raw key, so a missing string is never fatal.
 */
export function translate(lang, key, vars) {
  const dict = translations[lang] || translations.en
  let val = dict[key]
  if (val == null) val = translations.en[key]
  if (val == null) return key
  if (vars) {
    for (const k in vars) val = val.split(`{${k}}`).join(String(vars[k]))
  }
  return val
}

/**
 * Hook: returns a `t(key, vars)` bound to the current store language.
 * Subscribes to `language`, so any component using it re-renders on change.
 */
export function useTranslation() {
  const lang = useObservatoryStore((s) => s.language)
  const t = (key, vars) => translate(lang, key, vars)
  const tType = (type) => translateType(lang, type)
  return { t, tType, lang }
}
