import { FaTelegram } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

const Footer = () => (
  <footer className="w-full bg-gradient-to-r from-cyan-900/80 via-gray-900/90 to-blue-900/80 border-t border-gray-800 py-4 px-4 flex flex-col md:flex-row items-center justify-between fixed bottom-0 left-0 z-30 shadow-xl backdrop-blur-md">
    <span className="text-gray-300 text-sm mb-2 md:mb-0">© {new Date().getFullYear()} Unrugpad. All rights reserved.</span>
    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6">
      <span className="text-cyan-300 font-semibold text-base tracking-wide mb-1 md:mb-0">Connect with Us</span>
      <div className="flex gap-4">
        <a
          href="https://t.me/Unrugpad"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Unrugpad Telegram"
          className="text-gray-300 hover:text-cyan-400 transition-colors text-3xl md:text-4xl duration-200 transform hover:scale-110"
        >
          <FaTelegram />
        </a>
        <a
          href="https://x.com/Unrugpad"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Unrugpad Twitter (X)"
          className="text-gray-300 hover:text-cyan-400 transition-colors text-3xl md:text-4xl duration-200 transform hover:scale-110"
        >
          <FaXTwitter />
        </a>
      </div>
    </div>
  </footer>
);

export default Footer;
