import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clipboard, Info, Check, X } from "lucide-react";
import { getFirebaseRulesString, getFirebaseRulesInstructions, testFirebaseRules } from "@/utils/firebaseRules";

const FirebaseRulesManager: React.FC = () => {
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);
  const [copied, setCopied] = useState(false);

  const rulesString = getFirebaseRulesString();
  const instructions = getFirebaseRulesInstructions();

  const handleCopy = () => {
    navigator.clipboard.writeText(rulesString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTest = async () => {
    setTestResult({ success: false, message: "Testing rules..." });
    
    try {
      const result = await testFirebaseRules();
      if (result) {
        setTestResult({ 
          success: true, 
          message: "Rule testing completed. See console for detailed results." 
        });
      } else {
        setTestResult({ 
          success: false, 
          message: "Rule testing failed. See console for error details." 
        });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: `Rule testing failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Firebase Database Rules Manager</CardTitle>
        <CardDescription>
          View, test, and apply Firebase rules for your Trip Tracker application
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="rules">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="rules">Rules JSON</TabsTrigger>
            <TabsTrigger value="instructions">Instructions</TabsTrigger>
            <TabsTrigger value="test">Test Rules</TabsTrigger>
          </TabsList>
          
          <TabsContent value="rules" className="space-y-4">
            <div className="relative">
              <Button 
                variant="outline" 
                size="sm" 
                className="absolute right-2 top-2 z-10"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Clipboard className="h-4 w-4 mr-1" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              
              <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-slate-50 font-mono text-sm">
                <pre>{rulesString}</pre>
              </ScrollArea>
            </div>
          </TabsContent>
          
          <TabsContent value="instructions">
            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              <div className="prose prose-slate">
                <h3>How to Apply These Rules</h3>
                <p className="whitespace-pre-line">{instructions}</p>
                
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Important</AlertTitle>
                  <AlertDescription>
                    You must be logged in with administrator access to the Firebase project to update these rules.
                  </AlertDescription>
                </Alert>
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="test">
            <div className="space-y-4">
              <p>
                This will test if your current user has proper access to the Firebase database paths
                according to the rules. Check the browser console for detailed results.
              </p>
              
              <Button onClick={handleTest}>
                Test Rules Access
              </Button>
              
              {testResult && (
                <Alert className={testResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                  {testResult.success ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-red-600" />
                  )}
                  <AlertTitle>{testResult.success ? "Success" : "Error"}</AlertTitle>
                  <AlertDescription>
                    {testResult.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-gray-500">
          These rules define read/write access to different paths in your Firebase Realtime Database.
        </p>
      </CardFooter>
    </Card>
  );
};

export default FirebaseRulesManager;
