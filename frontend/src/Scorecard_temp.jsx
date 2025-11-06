import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PageBackground from './PageBackground';

function formatDate(dateVal) {
  if (!dateVal) return '';
  let dateObj;
  if (dateVal instanceof Date) {
    dateObj = dateVal;
  } else if (typeof dateVal === 'string') {
    dateObj = new Date(dateVal);
    if (isNaN(dateObj)) {
      const [year, month, day] = dateVal.split('-');
      if (year && month && day) return `${day}/${month}/${year}`;
      return dateVal;
    }
  } else {
    return '';
  }
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

const playerColors = [
  'bg-blue-100 text-blue-900',
  'bg-green-100 text-green-900',
  'bg-yellow-100 text-yellow-900',
  'bg-pink-100 text-pink-900'
];

const COMP_TYPE_DISPLAY = {
  fourBbbStableford: '4BBB Stableford',
  alliance: 'Alliance',
  medalStrokeplay: 'Medal Strokeplay',
  individualStableford: 'Individual Stableford',
};

const defaultHoles = [
  { number: 1, par: 4, index: 5 },
  { number: 2, par: 4, index: 7 },
  { number: 3, par: 3, index: 17 },
  { number: 4, par: 5, index: 1 },
  { number: 5, par: 4, index: 11 },
  { number: 6, par: 3, index: 15 },
  { number: 7, par: 5, index: 3 },
  { number: 8, par: 4, index: 13 },
  { number: 9, par: 4, index: 9 },
  { number: 10, par: 4, index: 10 },
  { number: 11, par: 4, index: 4 },
  { number: 12, par: 4, index: 12 },
  { number: 13, par: 5, index: 2 },
  { number: 14, par: 4, index: 14 },
  { number: 15, par: 3, index: 18 },
  { number: 16, par: 5, index: 6 },
  { number: 17, par: 3, index: 16 },
  { number: 18, par: 4, index: 8 },
];

// Deprecated temporary scorecard file. Cleared as part of cleanup.
// If you need the original contents, check your Git history or the snapshot file.
export default null;
