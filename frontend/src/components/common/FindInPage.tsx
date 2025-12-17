/*
 * Copyright 2025 The Kubernetes Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isElectron } from '../../helpers/isElectron';

interface FindResult {
  activeMatchOrdinal: number;
  matches: number;
}

/**
 * A find-in-page search bar component for the Electron desktop app.
 * This component provides browser-like Cmd+F/Ctrl+F functionality.
 */
export default function FindInPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [findResult, setFindResult] = useState<FindResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  // Only render in Electron
  if (!isElectron()) {
    return null;
  }

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    // Focus the input after a short delay to ensure it's mounted
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 100);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchText('');
    setFindResult(null);
    window.desktopApi?.send('stop-find-in-page', 'clearSelection');
  }, []);

  const handleSearch = useCallback(
    (forward = true, findNext = false) => {
      if (!searchText) {
        return;
      }
      window.desktopApi?.send('find-in-page', { text: searchText, forward, findNext });
    },
    [searchText]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'Enter') {
        if (e.shiftKey) {
          handleSearch(false, true); // Search backward
        } else {
          handleSearch(true, true); // Search forward
        }
      }
    },
    [handleClose, handleSearch]
  );

  // Listen for open-find-in-page event from main process
  useEffect(() => {
    if (!window.desktopApi) {
      return;
    }

    const handleOpenFind = () => {
      handleOpen();
    };

    window.desktopApi.receive('open-find-in-page', handleOpenFind);

    return () => {
      window.desktopApi?.removeListener('open-find-in-page', handleOpenFind);
    };
  }, [handleOpen]);

  // Listen for found-in-page results from main process
  useEffect(() => {
    if (!window.desktopApi) {
      return;
    }

    const handleFoundInPage = (result: FindResult) => {
      setFindResult(result);
      // Refocus input after search to prevent focus loss
      inputRef.current?.focus();
    };

    window.desktopApi.receive('found-in-page', handleFoundInPage);

    return () => {
      window.desktopApi?.removeListener('found-in-page', handleFoundInPage);
    };
  }, []);

  // Trigger search when text changes
  useEffect(() => {
    if (searchText) {
      window.desktopApi?.send('find-in-page', { text: searchText, forward: true, findNext: false });
    } else {
      setFindResult(null);
      window.desktopApi?.send('stop-find-in-page', 'clearSelection');
    }
  }, [searchText]);

  if (!isOpen) {
    return null;
  }

  return (
    <Paper
      elevation={4}
      data-find-in-page-bar
      sx={{
        position: 'fixed',
        top: 72,
        right: 16,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        p: 0.5,
        borderRadius: 1,
      }}
    >
      <TextField
        inputRef={inputRef}
        size="small"
        placeholder={t('Find in page')}
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
        onKeyDown={handleKeyDown}
        sx={{ minWidth: 200 }}
        InputProps={{
          endAdornment: findResult && searchText && (
            <InputAdornment position="end">
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                {findResult.matches > 0
                  ? `${findResult.activeMatchOrdinal}/${findResult.matches}`
                  : t('No matches')}
              </Typography>
            </InputAdornment>
          ),
        }}
      />
      <Box sx={{ display: 'flex' }}>
        <IconButton
          size="small"
          onClick={() => handleSearch(false, true)}
          disabled={!searchText || !findResult?.matches}
          title={t('Previous match (Shift+Enter)')}
          aria-label={t('Previous match')}
        >
          <KeyboardArrowUpIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => handleSearch(true, true)}
          disabled={!searchText || !findResult?.matches}
          title={t('Next match (Enter)')}
          aria-label={t('Next match')}
        >
          <KeyboardArrowDownIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={handleClose} title={t('Close (Escape)')} aria-label={t('Close find bar')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );
}
