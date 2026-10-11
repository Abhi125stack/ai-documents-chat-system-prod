import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_for_local_env";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "default_refresh_secret_key_change_in_prod";

export const generateToken = (userId: string) => {
    return jwt.sign({ userId }, JWT_SECRET, {
        expiresIn: "1h", // Access tokens should be short lived
    });
};

export const generateRefreshToken = (userId: string) => {
    return jwt.sign({ userId }, JWT_REFRESH_SECRET, {
        expiresIn: "7d", // Refresh tokens last longer
    });
};

export const verifyToken = (token: string) => {
    try {
        return jwt.verify(token, JWT_SECRET) as { userId: string };
    } catch {
        return null;
    }
};

export const verifyRefreshToken = (token: string) => {
    try {
        return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
    } catch {
        return null;
    }
};
