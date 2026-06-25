import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-4xl font-bold text-blue-900">⚽ Football Tournament</h1>
          <p className="text-gray-600 mt-2">Organize, manage, and track your tournament</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
         

          {/* Guest Section */}
          <Card className="border-2 border-green-200 hover:shadow-lg transition">
            <CardHeader>
              <CardTitle className="text-2xl">👤 Guest View</CardTitle>
              <CardDescription>View tournament information and statistics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              
             {/* <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ View all fixtures and results</li>
                <li>✓ Check points table</li>
                <li>✓ See top scorers</li>
                <li>✓ Browse team details</li>
              </ul> */}
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => navigate('/guest')}
              >
                Go to Guest View
              </Button>
            </CardContent>
          </Card>

           {/* Admin Section */}
          <Card className="border-2 border-blue-200 hover:shadow-lg transition">
            <CardHeader>
              <CardTitle className="text-2xl">🔑 Admin Panel</CardTitle>
              <CardDescription>Manage tournaments, teams, and matches</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* <p className="text-gray-700">
                Access the admin panel to create and manage tournaments, add teams, update match
                results, and track player statistics.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Manage teams and players</li>
                <li>✓ Create and update matches</li>
                <li>✓ Track tournament progress</li>
                <li>✓ Configure tournament type (League/Group Stage)</li>
              </ul>*/}
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => navigate('/admin')}
              >
                Go to Admin Panel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
