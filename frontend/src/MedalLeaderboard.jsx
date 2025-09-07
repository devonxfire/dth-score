import React from 'react';
import PageBackground from './PageBackground';
import TopMenu from './TopMenu';

export default function MedalLeaderboard(props) {
  return (
    <PageBackground>
      <TopMenu {...props} />
      <div className="flex flex-col items-center px-4 mt-12">
        <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-4" style={{ color: '#002F5F', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
          Medal Competition: Leaderboard
        </h1>
        <div className="max-w-4xl w-full bg-[#002F5F] rounded-2xl shadow-2xl p-8 border-4 border-[#FFD700] text-white" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
          <p className="mb-4">Individual stats: Gross, Net, DTH Net, Waters, Dog, 2 Clubs, Fines.</p>
          {/* Leaderboard UI will go here */}
        </div>
      </div>
    </PageBackground>
  );
}
