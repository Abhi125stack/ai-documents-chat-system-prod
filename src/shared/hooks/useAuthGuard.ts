"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export const useAuthGuard = (requireAuth: boolean = true) => {
    const router = useRouter();
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        const isAuthPage = pathname === "/login" || pathname === "/signup";

        if (requireAuth && !token) {
            // User is on a protected page but not authenticated
            router.replace("/login");
        } else if (!requireAuth && token && isAuthPage) {
            // User is on an auth page but already authenticated
            router.replace("/dashboard");
        } else {
            // Auth check passed for this route; release the loading gate.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsLoading(false);
        }
    }, [requireAuth, router, pathname]);

    return { isLoading };
};
