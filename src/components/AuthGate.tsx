import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";

interface Props {
	children: React.ReactNode;
}

export function AuthGate({ children }: Props) {
	const { user, loading } = useAuth();
	const location = useLocation();

	if (loading) {
		return (
			<div className="h-screen w-screen flex items-center justify-center bg-[#090a0f] text-gray-400">
				Loading...
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/login" state={{ from: location.pathname }} replace />;
	}

	return <>{children}</>;
}
