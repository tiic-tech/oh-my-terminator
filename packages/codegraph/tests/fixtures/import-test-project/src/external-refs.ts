/**
 * External package import examples.
 * Tests EXTERNAL node creation for npm packages.
 */

// Named import from external package - creates EXTERNAL:lodash node
import { debounce, throttle } from 'lodash';

// Default import from external package
import axios from 'axios';

// Namespace import from external package
import * as React from 'react';

// Named import with renaming from external package
import { debounce as debounceFn } from 'lodash';

// Import from scoped package
import { useState, useEffect } from 'react';

// Import from package with subpath
import { Button } from '@mui/material';

// Side-effect import (empty import specifier)
import './setup';

export function useExternalLibs(): void {
  debounce(() => {}, 100);
  axios.get('/api');
  React.createElement('div');
}