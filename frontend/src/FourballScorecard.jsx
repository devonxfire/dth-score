import React from 'react';
import PageBackground from './PageBackground';
import TopMenu from './TopMenu';

export default function FourballScorecard(props) {
  return (
    <PageBackground>
      <TopMenu {...props} />
      <div className="flex flex-col items-center px-4 mt-12">
        <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-4" style={{ color: '#002F5F', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
          4BBB Competition: Scorecard
        </h1>
        <div className="max-w-4xl w-full bg-[#002F5F] rounded-2xl shadow-2xl p-8 border-4 border-[#FFD700] text-white" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
          <p className="mb-4">All 4 players in the group are displayed, with team logic for points. Enter scores for each player.</p>
          {/* Scorecard UI will go here */}
        </div>
      </div>
    </PageBackground>
  );
}
