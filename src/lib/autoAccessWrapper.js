import { redirectIfNoAccess } from "./accessRedirect";

export const applyAutoAccessProtection = async (user, navigate, currentPath) => {
  const pathRules = [
    // 🧩 Accès lecture
    { path: "/rencontre", section: "rencontre", action: "read" },
    { path: "/annonces", section: "annonces", action: "read" },
    { path: "/partenaires", section: "partenaires", action: "read" },
    { path: "/marketplace", section: "partenaires", action: "read" },
    { path: "/evenements", section: "evenements", action: "read" },

    // 🧩 Accès publication
    { path: "/publier/evenement", section: "evenements", action: "create" },
    { path: "/publier/annonce", section: "annonces", action: "create" },
    { path: "/publier/partenaire", section: "partenaires", action: "create" },
  ];

  for (const rule of pathRules) {
    if (currentPath.startsWith(rule.path)) {
      await redirectIfNoAccess(user, navigate, rule.section, rule.action);
      break;
    }
  }
};

// ⚙️ Garde cette ligne absolument :
export default applyAutoAccessProtection;
