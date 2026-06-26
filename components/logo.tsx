import Image from "next/image";
import { Link } from "@/i18n/navigation";

/** Set `clickable={false}` to render the logo as plain (non-interactive) branding —
 *  used on the distraction-free IUL ads landing where the form is the only link. */
const Logo = ({ clickable = true }: { clickable?: boolean }) => {
  const inner = (
    <>
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden flex items-center justify-center">
        <Image
          src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_40,h_40,c_fill,g_auto/isaacplanslogo_tkraak.png"
          alt="Isaac Plans Logo"
          width={40}
          height={40}
          className="object-cover"
          priority
        />
      </div>
      <div className="flex flex-col items-center text-center leading-tight">
        <span className="text-sm sm:text-xl font-bold bg-gradient-to-r from-teal-600 to-blue-800 bg-clip-text text-transparent">
          Isaac Plans
        </span>
        <span className="text-xs sm:text-sm font-semibold tracking-widest uppercase bg-gradient-to-r from-teal-600 to-blue-800 bg-clip-text text-transparent">
          Insurance
        </span>
      </div>
    </>
  );

  if (!clickable) {
    return (
      <span className="flex items-center space-x-2" aria-label="Isaac Plans Insurance">
        {inner}
      </span>
    );
  }

  return (
    <Link href="/" className="flex items-center space-x-2">
      {inner}
    </Link>
  );
};

export default Logo;
