import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, ShoppingBag, MessageSquare, Calendar, Heart } from 'lucide-react';

const navItems = [
  { path: '/annonces', icon: FileText, label: 'Annonces' },
  { path: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
  { path: '/echange', icon: MessageSquare, label: 'Échange', isCentral: true },
  { path: '/evenements', icon: Calendar, label: 'Événements' },
  { path: '/rencontre', icon: Heart, label: 'Rencontres' },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isPathActive = (basePath) => {
    if (!basePath) return false;
    if (location.pathname === basePath) return true;
    return location.pathname.startsWith(`${basePath}/`);
  };

  const mainNavItems = navItems.filter(item => !item.isCentral);
  const centralItem = navItems.find(item => item.isCentral);

  // Distribute mainNavItems around the central button
  const itemsPerSide = Math.floor(mainNavItems.length / 2);
  const leftItems = mainNavItems.slice(0, itemsPerSide);
  const rightItems = mainNavItems.slice(itemsPerSide);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-28">
      <div
        className="absolute bottom-0 left-0 right-0 h-20 glass-effect border-t border-[#2BA84A]/20 bottom-nav-safe"
      >
        <div className="container mx-auto px-2 h-full">
          <div className="flex items-center justify-around h-full pt-2 pb-3 bottom-nav-inner">
            {leftItems.map(({ path, icon: Icon, label }) => {
              const isActive = isPathActive(path);
              return (
                <Link
                  key={path}
                  to={path}

                  className="flex flex-col items-center justify-center flex-1 h-full"
                >
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className={`flex flex-col items-center gap-1 transition-colors ${
                      isActive ? 'text-[#2BA84A]' : 'text-[#6B6B6B]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="bottomNavActiveUnderline"
                        className="mt-1 w-10 h-1 bg-[#2BA84A] rounded-full"
                      />
                    )}
                  </motion.div>
                </Link>
              );
            })}

            {/* Bouton central intégré au même niveau */}
            <Link
              to={centralItem.path}
              className="flex flex-col items-center justify-center flex-1 h-full"
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  isPathActive(centralItem.path) ? 'text-[#2BA84A]' : 'text-[#6B6B6B]'
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-[#2BA84A] text-white flex items-center justify-center">
                  <centralItem.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">{centralItem.label}</span>
                {isPathActive(centralItem.path) && (
                  <motion.div
                    layoutId="bottomNavActiveUnderline"
                    className="mt-1 w-10 h-1 bg-[#2BA84A] rounded-full"
                  />
                )}
              </motion.div>
            </Link>

            {rightItems.map(({ path, icon: Icon, label }) => {
              const isActive = isPathActive(path);
              return (
                <Link
                  key={path}
                  to={path}

                  className="flex flex-col items-center justify-center flex-1 h-full"
                >
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className={`flex flex-col items-center gap-1 transition-colors ${
                      isActive ? 'text-[#2BA84A]' : 'text-[#6B6B6B]'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="bottomNavActiveUnderline"
                        className="mt-1 w-10 h-1 bg-[#2BA84A] rounded-full"
                      />
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      
    </nav>
  );
};

export default BottomNav;
