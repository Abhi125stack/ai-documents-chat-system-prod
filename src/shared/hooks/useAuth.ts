import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AxiosError } from "axios";

import { AuthResponse, LoginCredentials, SignupData } from "@/types";

type ApiErrorData = { message?: string };

export const useAuth = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Login Mutation
  const loginMutation = useMutation({
      mutationFn: async (credentials: LoginCredentials) => {
      const response = await api.post<AuthResponse>("/auth/login", credentials);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        localStorage.setItem("token", data.token);
          if (data.refreshToken) {
              localStorage.setItem("refreshToken", data.refreshToken);
          }
        localStorage.setItem("user", JSON.stringify(data.user));
        toast.success(data.message || "Welcome back!");
        router.push("/dashboard");
        queryClient.invalidateQueries({ queryKey: ["user"] });
      }
    },
    onError: (error: AxiosError<ApiErrorData>) => {
      const message = error.response?.data?.message || "Login failed. Please check your credentials.";
      toast.error(message);
    },
  });

  // Signup Mutation
  const signupMutation = useMutation({
      mutationFn: async (userData: SignupData) => {
      const response = await api.post<AuthResponse>("/auth/signup", userData);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        localStorage.setItem("token", data.token);
          if (data.refreshToken) {
              localStorage.setItem("refreshToken", data.refreshToken);
          }
        localStorage.setItem("user", JSON.stringify(data.user));
        toast.success(data.message || "Account created successfully!");
        router.push("/dashboard");
        queryClient.invalidateQueries({ queryKey: ["user"] });
      }
    },
    onError: (error: AxiosError<ApiErrorData>) => {
      const message = error.response?.data?.message || "Registration failed. Email might already be taken.";
      toast.error(message);
    },
  });

  // Logout Function
  const logout = () => {
    localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    toast.info("Logged out successfully.");
    router.push("/login");
    queryClient.clear();
  };

  return {
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    signup: signupMutation.mutate,
    isSigningUp: signupMutation.isPending,
    logout,
  };
};
