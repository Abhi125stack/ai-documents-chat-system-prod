import { verifyToken } from "./jwt";

export const getUserIdFromHeader = (req: Request) => {
    try {
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return null;
        }

        const token = authHeader.split(" ")[1];
        const decoded = verifyToken(token);
        return decoded?.userId || null;
    } catch {
        return null;
    }
};
