import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const ChartePopup = ({ show, onAccept, onClose, readOnly = false, title, content }) => {
  return (
    <Dialog open={show} onOpenChange={!readOnly ? onClose : undefined}>
      <DialogOverlay className="bg-white/80 backdrop-blur-sm fixed inset-0 z-50" />
      <DialogContent className="max-w-lg z-50">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-[#2BA84A]">
            {title || 'Charte d’utilisation de OneKamer.co 🇨🇲'}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] p-4 border rounded-md">
          {content ? (
            <div className="space-y-4 text-sm text-gray-700">{content}</div>
          ) : (
            <div className="space-y-4 text-sm text-gray-700">
              <h2 className="font-bold text-lg">1. Notre vision</h2>
              <p>
                OneKamer.co est une plateforme communautaire pensée pour rassembler les Camerounaises, Camerounais et ami·e·s du Cameroun — du pays comme de la diaspora — autour d’un même espace d’échanges, d’entraide et d’opportunités. Notre mission : créer un réseau solidaire, positif et responsable, où chacune et chacun peut partager, entreprendre, rencontrer et s’informer dans le respect mutuel et la diversité culturelle du Cameroun.
              </p>
              <h2 className="font-bold text-lg">2. Nos valeurs</h2>
              <p>
                Respect, bienveillance, solidarité, authenticité et sécurité.
              </p>
              <h2 className="font-bold text-lg">3. Comportement attendu</h2>
              <p>
                En rejoignant OneKamer.co, vous vous engagez à utiliser la plateforme de manière respectueuse, éviter toute forme d’insulte, de harcèlement, de discrimination ou de contenu inapproprié, et à respecter la vie privée des membres.
              </p>
              <h2 className="font-bold text-lg">4. Espaces et fonctionnalités</h2>
              <p>
                OneKamer.co propose plusieurs espaces et fonctionnalités destinés à favoriser les échanges, l’entraide et les opportunités au sein de la communauté.
              </p>
              <h3 className="font-semibold">4.1 Annonces</h3>
              <p>
                L’espace Annonces permet aux membres de publier et consulter des annonces informatives ou personnelles. Ces échanges ne donnent pas lieu à un paiement intégré et relèvent de la responsabilité des membres concernés.
              </p>
              <h3 className="font-semibold">4.2 Groupes & échanges</h3>
              <p>
                Les groupes et espaces d’échange sont destinés aux discussions communautaires autour de centres d’intérêt communs. Les membres s’engagent à respecter les règles de courtoisie, de respect et de bienveillance.
              </p>
              <h3 className="font-semibold">4.3 Événements</h3>
              <p>
                L’espace Événements permet de créer et de participer à des événements communautaires. Certains événements peuvent être gratuits ou payants, selon les modalités définies par leurs organisateurs.
              </p>
              <h3 className="font-semibold">4.4 Rencontres</h3>
              <p>
                L’espace Rencontres est destiné aux échanges sociaux et personnels entre membres. Chaque membre reste responsable de ses interactions et de sa sécurité.
              </p>
              <h3 className="font-semibold">4.5 Marketplace</h3>
              <p>
                La marketplace permet l’achat et la vente de biens ou services entre membres via un système de paiement intégré. En raison de la présence de paiements, de livraisons et d’obligations spécifiques, l’utilisation de la marketplace est encadrée par des chartes dédiées acheteur et vendeur, accessibles depuis l’application.
              </p>
              <h3 className="font-semibold">4.6 OK Coins</h3>
              <p>
                OK Coins est un système de crédits internes permettant de soutenir ou valoriser certaines contributions au sein de la plateforme, selon les règles définies par OneKamer.co.
              </p>
              <h2 className="font-bold text-lg">5. Vie privée et données</h2>
              <p>
                Vos données sont protégées. Vous pouvez les modifier ou les supprimer à tout moment. Les conversations privées sont confidentielles.
              </p>
              <h2 className="font-bold text-lg">6. Sécurité et modération</h2>
              <p>
                L’équipe OneKamer.co veille à maintenir un espace sain ; les contenus contraires à la charte peuvent être modérés ou supprimés.
              </p>
              <h2 className="font-bold text-lg">7. Responsabilité</h2>
              <p>
                OneKamer.co facilite les échanges entre membres, mais chaque utilisateur·rice reste responsable de ses actions.
              </p>
              <h2 className="font-bold text-lg">8. Engagement communautaire</h2>
              <p>
                Contribuez à une communauté saine, inclusive et respectueuse.
              </p>
              <h2 className="font-bold text-lg">9. Mise à jour</h2>
              <p>
                La charte peut évoluer ; les membres seront informé·e·s des modifications importantes.
              </p>
              <h2 className="font-bold text-lg">10. Validation</h2>
              <p>
                ✅ En cliquant sur « J’ai lu et j’accepte la charte », vous reconnaissez avoir compris et accepté les règles d’utilisation de OneKamer.co. Bienvenue dans la communauté ! Ensemble, faisons rayonner le Cameroun et sa diaspora 🌍🇨🇲
              </p>
              <p className="text-xs text-gray-500">
                Version 1.0 - mise à jour le 29 janvier 2026
              </p>
            </div>
          )}
        </ScrollArea>
        {readOnly ? (
          <Button onClick={onClose} className="w-full mt-4">Fermer</Button>
        ) : (
          <Button onClick={onAccept} className="w-full mt-4">
            ✅ J’ai lu et j’accepte la charte
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ChartePopup;