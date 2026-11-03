// Garde des scripts qui écrivent en base : affiche la base visée et refuse toute base autre que la branche dev,
// sauf avec --prod en argument (écriture voulue sur la production).
const DEV = "ep-spring-truth-b9vjj7sz";

export function baseVisee() {
    const base = new URL(process.env.DATABASE_URL).hostname.split(".")[0].replace(/-pooler$/, "");
    console.log("Base :", base);
    if (base !== DEV && !process.argv.includes("--prod")) {
        console.error(`Ce n'est pas la base dev (${DEV}). Relancer avec --prod pour écrire sur ${base}.`);
        process.exit(1);
    }
    return base;
}
