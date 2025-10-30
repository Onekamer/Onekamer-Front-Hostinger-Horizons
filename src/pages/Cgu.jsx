
import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const CguPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Conditions Générales d’Utilisation (CGU) - OneKamer.co</title>
        <meta name="description" content="Consultez les Conditions Générales d’Utilisation (CGU) de la plateforme OneKamer.co." />
      </Helmet>
      <div className="max-w-4xl mx-auto py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Card className="shadow-lg border-t-4 border-t-[#2BA84A]">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-gray-800">
              Conditions Générales d’Utilisation (CGU)
            </CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none text-gray-700">
            <section>
              <h2 className="text-[#2BA84A] font-bold">1. Objet</h2>
              <p>Les présentes <strong>Conditions Générales d’Utilisation</strong> (CGU) régissent l’accès et l’utilisation du site et de l’application <strong>OneKamer.co</strong>, plateforme communautaire destinée à la diaspora camerounaise pour la mise en relation, les échanges, les annonces, les événements et les rencontres.</p>
              <p>En utilisant <strong>OneKamer.co</strong>, vous acceptez sans réserve les présentes conditions.</p>
            </section>
            
            <section>
              <h2 className="text-[#2BA84A] font-bold">2. Éditeur et hébergeur</h2>
              <p><strong>OneKamer SAS</strong><br/>
              Email : <strong>contact@onekamer.co</strong><br/>
              Siège social : <strong>60 Rue François 1er, 75008 Paris, France</strong></p>
              <p>Hébergement :</p>
              <ul>
                <li><strong>Supabase, Inc.</strong> – San Francisco, CA (infrastructure européenne conforme RGPD)</li>
                <li><strong>Render.com</strong> – USA (serveur d’application)</li>
                <li><strong>BunnyCDN</strong> – Slovénie (stockage média conforme RGPD)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold">3. Accès et inscription</h2>
              <p>L’accès à <strong>OneKamer.co</strong> nécessite la création d’un compte utilisateur.<br/>L’utilisateur s’engage à :</p>
              <ul>
                <li>Fournir des informations exactes et à jour ;</li>
                <li>Ne pas usurper l’identité d’un tiers ;</li>
                <li>Ne pas créer plusieurs comptes à des fins de contournement, fraude ou harcèlement.</li>
              </ul>
              <p>L’accès est réservé aux personnes âgées d’au moins <strong>18 ans</strong>.<br/><strong>OneKamer.co</strong> se réserve le droit de suspendre tout compte ne respectant pas ces conditions.</p>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold">4. Utilisation de la plateforme</h2>
              <p>L’utilisateur s’engage à :</p>
              <ul>
                <li>Adopter un comportement respectueux envers les autres membres ;</li>
                <li>Ne pas publier de contenu illégal, diffamatoire, discriminatoire, violent ou à caractère sexuel explicite ;</li>
                <li>Ne pas utiliser la plateforme à des fins commerciales non autorisées.</li>
              </ul>
              <p>Tout manquement pourra entraîner <strong>la suspension ou la suppression définitive du compte</strong>.</p>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold">5. Données personnelles</h2>
              <p><strong>OneKamer.co</strong> collecte et traite certaines données personnelles conformément au <strong>Règlement Général sur la Protection des Données (RGPD)</strong> et à la <strong>loi camerounaise n°2010/012</strong> sur la cybersécurité et la protection des données personnelles.<br/>Pour plus d’informations, consultez notre <Link to="/rgpd" className="text-[#2BA84A] hover:underline">Règlement RGPD</Link>.</p>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold">6. Contenus publiés par les utilisateurs</h2>
              <p>L’utilisateur reste seul responsable des contenus qu’il publie (texte, photo, audio, etc.).<br/>En publiant sur <strong>OneKamer.co</strong>, il accorde à la plateforme une <strong>licence non exclusive, mondiale et gratuite</strong> pour afficher, reproduire et diffuser ses contenus uniquement dans le cadre du service.</p>
              <p><strong>OneKamer.co</strong> se réserve le droit de supprimer tout contenu contraire à la loi ou aux présentes conditions.</p>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold">7. Signalements et modération</h2>
              <p>Les utilisateurs peuvent signaler un profil, un message ou un contenu via le <strong>Centre d’Aide</strong> intégré.<br/>Les équipes de <strong>OneKamer.co</strong> se réservent le droit de :</p>
              <ul>
                <li>Suspendre un compte le temps d’une vérification,</li>
                <li>Supprimer un contenu non conforme,</li>
                <li>Ou bannir définitivement un utilisateur en cas de récidive ou de comportement grave.</li>
              </ul>
            </section>
            
            <section>
              <h2 className="text-[#2BA84A] font-bold">8. Responsabilités</h2>
              <p><strong>OneKamer.co</strong> agit en tant qu’intermédiaire technique et n’est pas responsable :</p>
              <ul>
                <li>Des informations ou contenus publiés par les utilisateurs,</li>
                <li>Des rencontres, échanges ou transactions réalisées entre membres,</li>
                <li>D’éventuels dommages résultant d’un usage non conforme de la plateforme.</li>
              </ul>
              <p><strong>OneKamer.co</strong> s’efforce d’assurer la sécurité et la disponibilité du service mais ne garantit pas une disponibilité permanente.</p>
            </section>
            
            <section>
              <h2 className="text-[#2BA84A] font-bold">9. Suspension et suppression de compte</h2>
              <p><strong>OneKamer.co</strong> peut suspendre ou supprimer un compte :</p>
              <ul>
                <li>En cas de non-respect des présentes CGU,</li>
                <li>De fraude, usurpation ou utilisation abusive,</li>
                <li>Ou sur simple demande de l’utilisateur.</li>
              </ul>
              <p>La suppression entraîne l’effacement définitif des données personnelles sous 30 jours, conformément à la politique RGPD.</p>
            </section>
            
            <section>
              <h2 className="text-[#2BA84A] font-bold">10. Propriété intellectuelle</h2>
              <p>L’ensemble du contenu de la plateforme <strong>OneKamer.co</strong> (logo, design, code, textes, illustrations, bases de données) est protégé par les lois sur la propriété intellectuelle.<br/>Toute reproduction ou réutilisation sans autorisation préalable est interdite.</p>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold">11. Modifications des CGU</h2>
              <p><strong>OneKamer.co</strong> se réserve le droit de modifier les présentes CGU à tout moment.<br/>Les utilisateurs seront informés en cas de changement important.<br/>La date de dernière mise à jour est indiquée ci-dessous.</p>
            </section>

            <section>
              <h2 className="text-[#2BA84A] font-bold">12. Droit applicable et juridiction</h2>
              <p>Les présentes CGU sont régies par le <strong>droit français</strong>, sous réserve des règles impératives applicables.<br/>En cas de litige, compétence exclusive est attribuée aux tribunaux de <strong>Paris (France)</strong>.</p>
            </section>

            <hr />
            
            <footer className="text-center text-sm text-gray-500 mt-6">
              <p>📅 <strong>Dernière mise à jour : octobre 2025</strong></p>
              <p>© <strong>OneKamer.co / OneKamer SAS</strong> – Tous droits réservés</p>
              <p>Contact : <a href="mailto:contact@onekamer.co" className="text-[#2BA84A] hover:underline">contact@onekamer.co</a></p>
            </footer>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default CguPage;
