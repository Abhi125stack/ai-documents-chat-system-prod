import { NextResponse } from "next/server";
import { generateToken, verifyRefreshToken } from "@/lib/jwt";
import { getErrorMessage } from "@/lib/utils";

export async function POST(req: Request) {
    try {
        const { refreshToken } = await req.json();

        if (!refreshToken) {
            return NextResponse.json(
                { message: "Refresh token is missing", success: false },
                { status: 401 }
            );
        }

        const decoded = verifyRefreshToken(refreshToken);

        if (!decoded) {
            return NextResponse.json(
                { message: "Invalid or expired refresh token", success: false },
                { status: 403 }
            );
        }

        const newAccessToken = generateToken(decoded.userId);

        return NextResponse.json(
            {
                success: true,
                token: newAccessToken,
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        return NextResponse.json(
            { message: "Refresh failed", error: getErrorMessage(error), success: false },
            { status: 500 }
        );
    }
}
