import Image from "next/image";
import Link from "next/link";

const Logo = () => {
  return (
    <Link href="/" className="flex items-center space-x-2">
      <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
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
        <span className="text-xl font-bold bg-gradient-to-r from-teal-600 to-blue-800 bg-clip-text text-transparent">
          Isaac Plans
        </span>
        <span className="text-sm font-semibold tracking-widest uppercase bg-gradient-to-r from-teal-600 to-blue-800 bg-clip-text text-transparent">
          Insurance
        </span>
      </div>
    </Link>
  );
};

export default Logo;
