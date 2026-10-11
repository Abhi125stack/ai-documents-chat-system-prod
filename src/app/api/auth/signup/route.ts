import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { generateToken, generateRefreshToken } from "@/lib/jwt";
import { getErrorMessage } from "@/lib/utils";

export async function POST(req: Request) {
    try {
        await connectDB();
        const { name, email, password } = await req.json();

        // 1. Basic validation
        if (!name || !email || !password) {
            return NextResponse.json(
                { message: "Missing required fields.", success: false },
                { status: 400 }
            );
        }

        // 2. Email uniqueness check
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return NextResponse.json(
                { message: "Account already exists with this email.", success: false },
                { status: 409 }
            );
        }

        // 3. Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // 4. Create User
        const newUser = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
        });

        // 5. Generate tokens
        const accessToken = generateToken(newUser._id.toString());
        const refreshToken = generateRefreshToken(newUser._id.toString());

        // 6. Respond with tokens and user data
        return NextResponse.json(
            {
                message: "Account created successfully!",
                success: true,
                user: {
                    id: newUser._id,
                    name: newUser.name,
                    email: newUser.email,
                },
                token: accessToken,
                refreshToken: refreshToken,
            },
            { status: 201 }
        );
    } catch (err: unknown) {
        console.error("Signup error:", err);
        return NextResponse.json(
            { message: "An error occurred during registration.", error: getErrorMessage(err), success: false },
            { status: 500 }
        );
    }
}
