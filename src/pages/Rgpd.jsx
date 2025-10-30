import React from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const RgpdPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Règlement RGPD - OneKamer.co</title>
        <meta
          name="description"
          content="Découvrez comment OneKamer.co protège vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD)."
        />
      </Helmet>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>

        <Card className="shadow-lg border-t-4 border-t-[#2BA84A]">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-gray-800 text-center">
              Règlement Général sur la Protection des Données (RGPD)
            </CardTitle>
          </CardHeader>

          <CardContent className="prose max-w-none text-gray-700 leading-relaxed space-y-6">

            <section>
              <h2 className="text-[#2BA84A] font-bold text-xl mb-2">1. Notre engagement</h2>
              <p>
                Chez <strong>OneKamer.co</strong>, nous respectons votre vie privée et nous protégeons vos données personnelles
                conformément au <strong>Règlement (UE) 2016/679</strong> (RGPD) et à la
                <strong> loi camerounaise n°2010/012</strong> relative à la cybersécurité et à la protection des données personnelles.
              </p>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold text-xl mb-2">2. Responsable du traitement</h2>
              <p>
                Le responsable du traitement des données est :<br />
                <strong>OneKamer SAS</strong><br />
                Siège social : <strong>60 Rue François 1er, 75008 Paris, France</strong><br />
                Email : <a href="mailto:contact@onekamer.co" className="text-[#2BA84A] hover:underline">contact@onekamer.co</a>
              </p>
              <p>
                Aucun délégué à la protection des données (DPO) n’est actuellement désigné, mais toute demande peut être adressée à l’adresse email ci-dessus.
              </p>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold text-xl mb-2">3. Hébergement et prestataires</h2>
              <ul className="list-disc pl-6">
                <li><strong>Supabase, Inc.</strong> – San Francisco, CA (EU infrastructure conforme RGPD) → stockage sécurisé des données utilisateurs.</li>
                <li><strong>BunnyCDN</strong> – Slovénie (UE) → hébergement et diffusion des contenus médias statiques.</li>
                <li><strong>Render.com</strong> – États-Unis → hébergement du serveur d’application (conformité SCC RGPD).</li>
              </ul>
              <p>Ces prestataires respectent des standards élevés de sécurité et de confidentialité.</p>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold text-xl mb-2">4. Données collectées</h2>
              <ul className="list-disc pl-6">
                <li><strong>Informations de compte</strong> : nom, prénom, adresse e-mail, photo de profil, téléphone (si renseigné)</li>
                <li><strong>Données de profil</strong> : âge, genre, localisation, ethnie, taille, morphologie, préférences de rencontre, description, etc.</li>
                <li><strong>Données d’activité</strong> : messages, publications, likes, signalements, interactions sociales</li>
                <li><strong>Données techniques</strong> : IP, appareil, OS, navigateur, langue, fuseau horaire</li>
              </ul>
              <p>
                Certaines informations, comme l’ethnie ou la morphologie, peuvent être considérées comme
                <strong> des données à caractère particulier</strong>.
                Elles sont fournies <strong>volontairement</strong> par l’utilisateur et utilisées uniquement pour
                améliorer la mise en relation sur la plateforme.
                Aucune donnée de santé, religieuse ou politique n’est collectée.
              </p>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold text-xl mb-2">5. Finalités du traitement</h2>
              <ul className="list-disc pl-6">
                <li>Création et gestion du compte utilisateur</li>
                <li>Personnalisation des suggestions et interactions</li>
                <li>Sécurisation de la plateforme et prévention des abus</li>
                <li>Fonctionnalités sociales et notifications internes</li>
                <li>Amélioration continue de l’expérience utilisateur</li>
              </ul>
              <p>Les données de profil ne sont <strong>jamais revendues</strong> ni utilisées à des fins publicitaires.</p>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold text-xl mb-2">6. Base légale</h2>
              <ul className="list-disc pl-6">
                <li>Consentement explicite (création de compte, notifications, profil rencontre)</li>
                <li>Exécution du contrat (utilisation de la plateforme)</li>
                <li>Intérêt légitime (sécurité, lutte contre la fraude et les abus)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold text-xl mb-2">7. Durée de conservation</h2>
              <p>Les données sont conservées :</p>
              <ul className="list-disc pl-6">
                <li>Tant que le compte est actif</li>
                <li>Jusqu’à 30 jours après suppression du compte (sécurité et litiges éventuels)</li>
              </ul>
              <p>Elles sont ensuite <strong>supprimées définitivement</strong> de nos serveurs.</p>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold text-xl mb-2">8. Vos droits</h2>
              <ul className="list-disc pl-6">
                <li>Droit d’accès, de rectification et de suppression</li>
                <li>Droit d’opposition et de portabilité</li>
                <li>Droit de retirer votre consentement</li>
              </ul>
              <p>Pour toute demande : <a href="mailto:contact@onekamer.co" className="text-[#2BA84A] hover:underline">contact@onekamer.co</a></p>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold text-xl mb-2">9. Sécurité</h2>
              <ul className="list-disc pl-6">
                <li>Connexion sécurisée (HTTPS / TLS)</li>
                <li>Gestion des accès par rôles (RLS Supabase)</li>
                <li>Surveillance et détection d’anomalies</li>
                <li>Sauvegardes automatiques conformes RGPD</li>
              </ul>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold text-xl mb-2">10. Transferts internationaux</h2>
              <p>
                Certains de nos partenaires peuvent stocker des données hors de l’Union européenne,
                mais uniquement dans des pays reconnus comme adéquats par la Commission européenne
                ou couverts par des clauses contractuelles types.
              </p>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold text-xl mb-2">11. Mises à jour</h2>
              <p>
                Cette politique peut être modifiée à tout moment afin de s’adapter à la législation
                ou à l’évolution de nos services. La date de dernière mise à jour est indiquée ci-dessous.
              </p>
            </section>

            <hr className="my-6" />

            <footer className="text-center text-sm text-gray-500 mt-4">
              <p>📅 <strong>Dernière mise à jour : octobre 2025</strong></p>
              <p>© <strong>OneKamer.co / OneKamer SAS</strong> – Tous droits réservés</p>
              <p>
                Contact : <a href="mailto:contact@onekamer.co" className="text-[#2BA84A] hover:underline">
                  contact@onekamer.co
                </a>
              </p>
            </footer>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default RgpdPage;
