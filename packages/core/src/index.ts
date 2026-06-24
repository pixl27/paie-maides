/**
 * @maides/core — Moteurs méta du constructeur d'applications « maides ».
 *
 * Modules :
 *  - expression : langage de règles métier (interpréteur d'expressions).
 *  - metamodel  : patrons (tables) et champs.
 *  - r4         : couches de paramétrage multi-tenant.
 *  - (à venir)  : runtime générique, designers.
 */
export * as expression from './expression/index.js';
export * as metamodel from './metamodel/index.js';
export * as r4 from './r4/index.js';
export * as runtime from './runtime/index.js';
export * as data from './data/index.js';
export * as rendering from './rendering/index.js';
export * as designer from './designer/index.js';
export * as auth from './auth/index.js';
export * as menu from './menu/index.js';
export * as services from './services/index.js';
export * as ged from './ged/index.js';
export * as tenant from './tenant/index.js';
export * as scaffold from './scaffold/index.js';
export * as migration from './migration/index.js';

export { MdExpression, evaluer, evaluerValeur, registerFunction, unregisterFunction } from './expression/index.js';
export { creerPatron, initRecord, type Patron, type Champ, type TypeChamp, type Relation } from './metamodel/index.js';
export { R4, MemoryLayerStore, r4Providers } from './r4/index.js';
export type { LayerStore, LayerId } from './r4/index.js';
export { Runtime, formulage, validationSaisie, SpecifiqueRegistry, PileNavigation, parseOrdre, type Specifique, type SpecifiqueContexte, type Zzz, type Ecran, type Widget, type EntreePile } from './runtime/index.js';
export { renderEcran, renderWidget, renderTemplate, renderListe, enregistreWidget, compileTemplate, lireOptions, typesWidgetsSupportes, type ColonneListe, type CompileTemplateContexte, type WidgetDataAcces, type RenderContexte } from './rendering/index.js';
export {
  PatronEditor, EcranEditor,
  MenuEditor, DroitEditor, FormuleEditor, TableParamEditor, VueEditor, SequenceEcranEditor, RelationEditor,
  type ValeurDroit,
} from './designer/index.js';
export { hashPassword, verifyPassword, authentifier, MemoryUserStore, toUserInfo, ecranEstAutorise, menuEstVisible } from './auth/index.js';
export { construitMenu, renderMenu, feuillesMenu, MENU_DEFAUT, entreesMenuOuDefaut, type MenuEntry } from './menu/index.js';
export {
  BatchRunner, MassMailing, genererDocumentHtml, genererPdf,
  documentImprimable, genererImpression, MemoryMailer, FonctionMailer,
  SimplePdfRenderer, htmlVersPdf, PuppeteerPdfRenderer,
  detecterFormat, estPdf, Requetteur,
  type Mailer, type PdfRenderer, type Message, type OptionsImpression,
  type OptionsPdf, type OptionsPuppeteer, type LanceurNavigateur,
  type FormatDoc, type Vignetteur, type RequeteStore, type ExecuteurSQL,
} from './services/index.js';
export { MemoryGed, GedService, FichierScanner, base64VersOctets, type GedStore, type Document, type DocumentEntrant, type Scanner } from './ged/index.js';
export { TenantRegistry, type Entreprise } from './tenant/index.js';
export { initialiserApplication, creerApplicationDeBase, PATRONS_SYSTEME } from './scaffold/index.js';
export { importerDefinitions, importerLegacy, depuisLignesLegacy, type Dump, type PatronImport } from './migration/index.js';

// Types transverses
export type { UserInfo, ExpMessage, Providers, ChampDef } from './expression/index.js';
export type { UserStore, CompteUtilisateur } from './auth/index.js';
