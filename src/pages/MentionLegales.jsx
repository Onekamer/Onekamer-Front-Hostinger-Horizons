
import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const MentionsLegalesPage = () => {
  const navigate = useNavigate();
  const titleStyle = { color: '#2BA84A', fontWeight: 700 };

  return (
    <>
      <Helmet>
        <title>Mentions Légales - OneKamer.co</title>
        <meta name="description" content="Consultez les mentions légales de la plateforme OneKamer.co." />
      </Helmet>
      <div className="max-w-4xl mx-auto py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Card className="shadow-lg border-t-4 border-t-[#2BA84A]">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-gray-800">
              Mentions légales
            </CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none text-gray-700">
            <p>Conformément à la loi française n°2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique (LCEN), voici les mentions légales relatives au site et à l’application <strong>OneKamer.co</strong>.</p>
            
            <hr />

            <section>
              <h3 style={titleStyle}>1. Éditeur du site</h3>
              <p><strong>OneKamer SAS</strong><br/>
              Société par actions simplifiée au capital de <strong>2 €</strong><br/>
              Siège social : <strong>60 Rue François 1er, 75008 Paris, France</strong><br/>
              Email : <strong>contact@onekamer.co</strong><br/>
              Numéro SIREN : <strong>991 019 720</strong><br/>
              Directeur de la publication : <strong>OneKamer SAS</strong></p>
            </section>

            <section>
              <h3 style={titleStyle}>2. Hébergeurs et prestataires techniques</h3>
              <ul>
                <li><strong>Supabase, Inc.</strong> – San Francisco, CA<br/>(Infrastructure européenne conforme RGPD – stockage des données utilisateurs)</li>
                <li><strong>Render.com</strong> – USA<br/>(Hébergement du serveur d’application – conformité RGPD via Clauses contractuelles types)</li>
                <li><strong>BunnyCDN</strong> – Slovénie (Union Européenne)<br/>(Hébergement et diffusion des contenus médias – images et fichiers statiques)</li>
              </ul>
            </section>

            <section>
              <h3 style={titleStyle}>3. Propriété intellectuelle</h3>
              <p>L’ensemble du contenu présent sur <strong>OneKamer.co</strong> (structure, textes, images, graphismes, logos, bases de données, code source, etc.) est la propriété exclusive de <strong>OneKamer SAS</strong>, sauf mentions contraires.</p>
              <p>Toute reproduction, distribution, modification, adaptation ou publication, même partielle, de ces éléments est strictement interdite sans l’autorisation écrite préalable de <strong>OneKamer SAS</strong>.</p>
              <p>Toute utilisation non autorisée du contenu ou du code source du site est susceptible de constituer une contrefaçon au sens des articles L335-2 et suivants du Code de la Propriété Intellectuelle.</p>
            </section>

            <section>
              <h3 style={titleStyle}>4. Données personnelles</h3>
              <p>Les informations recueillies sur <strong>OneKamer.co</strong> font l’objet d’un traitement informatique destiné à la gestion des comptes utilisateurs et à la personnalisation des services.</p>
              <p><strong>OneKamer SAS</strong> s’engage à protéger la confidentialité des données personnelles conformément au <strong>Règlement Général sur la Protection des Données (RGPD)</strong> et à la <strong>loi camerounaise n°2010/012</strong> sur la cybersécurité et la protection des données personnelles.</p>
              <p>Pour plus d’informations, consultez notre <Link to="/rgpd" className="text-[#2BA84A] hover:underline">Règlement RGPD</Link>.</p>
            </section>

            <section>
              <h3 style={titleStyle}>5. Responsabilités</h3>
              <p><strong>OneKamer.co</strong> met tout en œuvre pour assurer l’exactitude et la mise à jour des informations publiées, mais ne saurait être tenue responsable :</p>
              <ul>
                <li>des erreurs ou omissions éventuelles,</li>
                <li>d’une interruption temporaire du site ou de l’application,</li>
                <li>ou de tout dommage direct ou indirect résultant de l’accès ou de l’utilisation de la plateforme.</li>
              </ul>
              <p>L’utilisateur est seul responsable de l’usage qu’il fait du contenu disponible sur <strong>OneKamer.co</strong>.</p>
            </section>

            <section>
              <h3 style={titleStyle}>6. Liens externes</h3>
              <p>Le site peut contenir des liens vers d’autres sites externes.<br/><strong>OneKamer SAS</strong> décline toute responsabilité quant au contenu ou aux pratiques de confidentialité de ces sites tiers.</p>
            </section>

            <section>
              <h3 style={titleStyle}>7. Contact</h3>
              <p>Pour toute question, demande ou signalement :<br/>
              📩 <strong>contact@onekamer.co</strong></p>
            </section>
            
            <hr />
            
            <footer className="text-center text-sm text-gray-500 mt-6">
              <p>📅 <strong>Dernière mise à jour : octobre 2025</strong></p>
              <p>© <strong>OneKamer.co / OneKamer SAS</strong> – Tous droits réservés</p>
            </footer>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default MentionsLegalesPage;
