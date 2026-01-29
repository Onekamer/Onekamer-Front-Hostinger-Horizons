import React from 'react';

export const MARKET_BUYER_CHARTER = (
  <>
    <h2 className="font-bold text-lg">1. Rôle de l’acheteur</h2>
    <p>
      La marketplace OneKamer.co permet aux membres d’acheter des biens ou services proposés par d’autres membres de la communauté.
    </p>
    <p>
      En tant qu’acheteur, vous effectuez vos achats directement auprès des vendeurs.
      OneKamer.co agit en tant que plateforme intermédiaire, facilitant la mise en relation et le paiement, sans être partie au contrat de vente conclu entre l’acheteur et le vendeur.
    </p>

    <h2 className="font-bold text-lg">2. Processus d’achat</h2>
    <p>Avant de finaliser un achat, l’acheteur est invité à :</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>consulter attentivement la description du produit ou du service ;</li>
      <li>vérifier le prix, les frais de livraison et les informations fournies par le vendeur ;</li>
      <li>s’assurer que les conditions proposées répondent à ses attentes avant validation de la commande.</li>
    </ul>
    <p>
      La messagerie entre l’acheteur et le vendeur devient accessible uniquement après la validation du paiement, afin de faciliter les échanges liés au suivi de la commande.
    </p>
    <p>
      Chaque commande passée sur la marketplace nécessite une acceptation explicite des conditions d’utilisation de la marketplace.
    </p>

    <h2 className="font-bold text-lg">3. Paiement et frais de service</h2>
    <p>Les paiements sur la marketplace OneKamer.co sont effectués exclusivement via le partenaire de paiement Stripe.</p>
    <p>L’acheteur reconnaît et accepte que :</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>des frais de service fixes de 10 % soient appliqués ;</li>
      <li>ces frais sont calculés sur le montant total du panier, incluant le prix des articles et les frais de livraison ;</li>
      <li>les frais de service contribuent au fonctionnement, à la maintenance et à la sécurisation de la plateforme.</li>
    </ul>

    <h2 className="font-bold text-lg">4. Livraison et réception des commandes</h2>
    <p>Selon les modalités définies par le vendeur, la commande peut être :</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>expédiée avec ou sans suivi ;</li>
      <li>remise en main propre ;</li>
      <li>ou livrée selon toute autre méthode indiquée dans la fiche du produit.</li>
    </ul>
    <p>Une fois la commande validée, l’acheteur peut :</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>consulter les informations relatives à l’expédition ;</li>
      <li>accéder à la messagerie liée à la commande ;</li>
      <li>échanger avec le vendeur concernant le suivi, la livraison ou toute information utile.</li>
    </ul>
    <p>L’acheteur est invité à signaler rapidement tout problème rencontré.</p>

    <h2 className="font-bold text-lg">5. Responsabilité de l’acheteur</h2>
    <p>L’acheteur s’engage à :</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>utiliser la marketplace de manière honnête et responsable ;</li>
      <li>effectuer ses paiements de bonne foi ;</li>
      <li>respecter les règles de la plateforme et les engagements pris lors de l’achat ;</li>
      <li>communiquer de façon respectueuse avec les vendeurs.</li>
    </ul>
    <p>
      Toute tentative de fraude, d’abus ou de détournement des mécanismes de paiement pourra entraîner des mesures de modération.
    </p>

    <h2 className="font-bold text-lg">6. Litiges et échanges</h2>
    <p>En cas de difficulté liée à une commande, l’acheteur est invité à :</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>utiliser en priorité la messagerie associée à la commande, accessible après l’achat ;</li>
      <li>privilégier un échange respectueux et constructif avec le vendeur ;</li>
      <li>rechercher une solution amiable.</li>
    </ul>
    <p>
      OneKamer.co peut, dans certains cas, faciliter la compréhension des échanges, sans être partie au contrat de vente ni garantir la résolution des litiges entre membres.
    </p>

    <h2 className="font-bold text-lg">7. Engagement communautaire</h2>
    <p>En utilisant la marketplace OneKamer.co, l’acheteur contribue à une communauté fondée sur :</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>le respect ;</li>
      <li>la confiance ;</li>
      <li>la transparence.</li>
    </ul>
    <p>
      Tout comportement contraire aux valeurs de la plateforme pourra donner lieu à des mesures adaptées afin de préserver un environnement sain pour l’ensemble des membres.
    </p>

    <h2 className="font-bold text-lg">8. Mise à jour de la charte</h2>
    <p>
      La présente charte acheteur peut évoluer afin de s’adapter aux évolutions de la plateforme ou du cadre réglementaire.
    </p>
    <p>
      Les acheteurs seront informés des modifications importantes et pourront être invités à accepter une version mise à jour lors d’un futur achat.
    </p>

    <h2 className="font-bold text-lg">9. Validation</h2>
    <p>
      ✅ En validant une commande sur la marketplace, vous reconnaissez avoir lu, compris et accepté la charte acheteur de la marketplace OneKamer.co.
    </p>
    <p className="text-xs text-gray-500">Version : 1.0 - mise à jour le 29 janvier 2026</p>
  </>
);

export const MARKET_VENDOR_CHARTER = (
  <>
    <h2 className="font-bold text-lg">1. Rôle du vendeur</h2>
    <p>
      La marketplace OneKamer.co permet aux membres de proposer des biens ou services à la vente au sein de la communauté.
    </p>
    <p>
      En tant que vendeur, vous agissez en votre nom propre et êtes seul responsable des produits ou services que vous proposez, ainsi que de leur conformité.
    </p>
    <p>
      OneKamer.co agit en tant que plateforme intermédiaire facilitant la mise en relation entre vendeurs et acheteurs, et ne vend pas directement les produits ou services proposés sur la marketplace.
    </p>

    <h2 className="font-bold text-lg">2. Conditions pour vendre sur la marketplace</h2>
    <p>Pour vendre sur la marketplace OneKamer.co, le vendeur s’engage à :</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>fournir des informations exactes, claires et sincères sur les produits ou services proposés ;</li>
      <li>proposer uniquement des produits ou services autorisés par la loi et conformes aux règles de la plateforme ;</li>
      <li>respecter la charte d’utilisation générale de OneKamer.co ainsi que les règles communautaires.</li>
    </ul>
    <p>
      Le vendeur reconnaît que l’accès à la vente sur la marketplace peut être conditionné à des critères techniques ou réglementaires définis par la plateforme.
    </p>

    <h2 className="font-bold text-lg">3. Paiement et éligibilité Stripe</h2>
    <p>
      Les paiements effectués sur la marketplace OneKamer.co sont réalisés exclusivement via le partenaire de paiement Stripe.
    </p>
    <p>Pour pouvoir vendre, le vendeur doit :</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>disposer d’un compte Stripe éligible ;</li>
      <li>compléter les informations requises par Stripe (identité, coordonnées, informations bancaires).</li>
    </ul>
    <p>
      OneKamer.co ne pourra être tenu responsable d’un refus, d’un blocage ou d’un retard de paiement lié à des obligations imposées par Stripe.
    </p>

    <h2 className="font-bold text-lg">4. Prix, frais de service et TVA</h2>
    <p>Le vendeur fixe librement le prix de ses produits ou services.</p>
    <p>Le vendeur reconnaît et accepte que :</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>OneKamer.co applique des frais de service fixes de 10 % ;</li>
      <li>ces frais sont calculés sur le montant total du panier, incluant le prix des articles et les frais de livraison ;</li>
      <li>les frais de service sont automatiquement déduits lors de la transaction.</li>
    </ul>
    <p>
      La TVA sur les articles ou services vendus n’est pas prise en charge par OneKamer.co.
      Les vendeurs concernés par la TVA sont responsables de :
    </p>
    <ul className="list-disc pl-5 space-y-1">
      <li>l’application des règles fiscales qui leur sont propres ;</li>
      <li>l’intégration de ces éléments dans leurs prix.</li>
    </ul>

    <h2 className="font-bold text-lg">5. Commandes et livraison</h2>
    <p>Le vendeur s’engage à :</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>traiter les commandes avec sérieux et dans des délais raisonnables ;</li>
      <li>communiquer de manière claire avec les acheteurs via la messagerie intégrée ;</li>
      <li>fournir, lorsque cela est applicable, un lien de suivi de livraison ou toute information utile concernant l’expédition.</li>
    </ul>
    <p>
      Dans le cas d’une remise en main propre, le vendeur s’engage à définir clairement les modalités avec l’acheteur.
    </p>

    <h2 className="font-bold text-lg">6. Responsabilité du vendeur</h2>
    <p>Le vendeur est seul responsable :</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>de la description et de la conformité des produits ou services proposés ;</li>
      <li>de la bonne exécution des commandes ;</li>
      <li>de la relation avec l’acheteur et de la résolution amiable des éventuels litiges.</li>
    </ul>
    <p>
      OneKamer.co ne saurait être tenu responsable des transactions, échanges ou différends intervenant entre les membres.
    </p>

    <h2 className="font-bold text-lg">7. Comportement et engagement communautaire</h2>
    <p>Le vendeur s’engage à :</p>
    <ul className="list-disc pl-5 space-y-1">
      <li>adopter un comportement respectueux et honnête ;</li>
      <li>communiquer de bonne foi avec les acheteurs ;</li>
      <li>contribuer à une expérience positive, sécurisée et bienveillante pour l’ensemble de la communauté.</li>
    </ul>
    <p>
      Tout comportement abusif, frauduleux ou contraire aux valeurs de OneKamer.co pourra entraîner des mesures de modération ou la suspension de l’accès à la marketplace.
    </p>

    <h2 className="font-bold text-lg">8. Mise à jour de la charte</h2>
    <p>
      La présente charte vendeur peut évoluer afin de s’adapter aux évolutions de la plateforme ou du cadre réglementaire.
    </p>
    <p>
      Les vendeurs seront informés des modifications importantes et pourront être invités à accepter une version mise à jour pour continuer à vendre sur la marketplace.
    </p>

    <h2 className="font-bold text-lg">9. Validation</h2>
    <p>
      ✅ En activant le mode vendeur ou en publiant une première annonce sur la marketplace, vous reconnaissez avoir lu, compris et accepté la charte vendeur de la marketplace OneKamer.co.
    </p>
    <p className="text-xs text-gray-500">Version : 1.0 - mise à jour le 29 janvier 2026</p>
  </>
);
