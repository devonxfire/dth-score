import React from 'react';
import PageBackground from './PageBackground';
import TopMenu from './TopMenu';

export default function FourballLeaderboard(props) {
  const [loading, setLoading] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const handleRefresh = async () => {
    setLoading(true);
    setRefreshKey(k => k + 1);
    setLoading(false);
  };
  return (
    <PageBackground>
      <TopMenu {...props} />
      <div className="flex flex-col items-center px-4 mt-12 w-full">
        <div className="w-full max-w-4xl mb-4">
          <div className="flex justify-between items-center mb-2 w-full">
            <button
              className="extras-toggle text-xs px-2 py-1 rounded font-semibold border border-[#FFD700] bg-[#0e3764] text-[#FFD700] shadow-lg mr-2"
              style={{ minWidth: 160 }}
              onClick={handleRefresh}
              disabled={loading}
            >
              &#x21bb; {loading ? 'Refreshing...' : 'Refresh Leaderboard'}
            </button>
          </div>
        </div>
        <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-4" style={{ color: '#002F5F', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
          4BBB Competition: Leaderboard
        </h1>
        <div className="max-w-4xl w-full bg-[#002F5F] rounded-2xl shadow-2xl p-8 border-4 border-[#FFD700] text-white" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
          <p className="mb-4">Team stats: Points, Gross, Net, Waters, Dog, 2 Clubs, Fines.</p>
          {/* Leaderboard UI will go here */}
        </div>
      </div>
    </PageBackground>
  );
}
