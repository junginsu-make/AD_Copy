"use client";

import { useRouter } from "next/navigation";
import { getUser, removeToken } from "@/lib/auth/client";
import { useEffect, useState } from "react";

export function Navbar() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const user = getUser();
    setCurrentUser(user);
  }, []);

  const handleLogout = () => {
    removeToken();
    setCurrentUser(null);
    router.push("/login");
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:from-blue-700 hover:to-purple-700 cursor-pointer"
            >
              Pltt. AD Copy
            </button>
          </div>

          <div className="flex items-center space-x-6">
            {currentUser && (
              <>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {currentUser.name || currentUser.email}
                  </p>
                  <p className="text-xs text-gray-500">{currentUser.email}</p>
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 transition"
                >
                  대시보드
                </button>
                <div className="h-4 w-px bg-gray-300"></div>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition"
                >
                  로그아웃
                </button>
              </>
            )}
            {!currentUser && (
              <>
                <button
                  onClick={() => router.push("/login")}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  로그인
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

