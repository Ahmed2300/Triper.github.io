import FirebaseRulesManager from "@/components/FirebaseRulesManager";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const FirebaseRules = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to App
            </Button>
          </Link>
        </div>
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-900">Firebase Rules Manager</h1>
          <p className="text-blue-700 mt-2">
            Manage and update your Firebase database rules for the Trip Tracker application
          </p>
        </div>
        
        <FirebaseRulesManager />
        
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">About Firebase Rules</h2>
          <p className="text-sm text-blue-700">
            Firebase Database Rules determine who has read and write access to your database, how your data is structured, and what indexes exist.
            The rules you've defined include permissions for users, ride requests, driver locations, and more.
          </p>
          <p className="text-sm text-blue-700 mt-2">
            You can use these rules in both your original project (C:\Users\mazam\Desktop\trip-tracker-mobile-main) 
            and your current project (C:\Users\mazam\Desktop\New folder (2)\trip-tracker-mobile-main).
          </p>
        </div>
      </div>
    </div>
  );
};

export default FirebaseRules;
