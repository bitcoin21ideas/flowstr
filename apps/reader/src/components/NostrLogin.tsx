import React, { useState, useEffect } from 'react'

import { useForceRender } from '../hooks/useForceRender'
import { nostrAuth, LoginMethod } from '../nostr'

import { Button } from './Button'

interface NostrLoginProps {
  onLogin?: () => void
  onLogout?: () => void
}

export const NostrLogin: React.FC<NostrLoginProps> = ({ onLogin, onLogout }) => {
  const [nsec, setNsec] = useState('')
  const [remotePubkey, setRemotePubkey] = useState('')
  const [localNsec, setLocalNsec] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [userProfile, setUserProfile] = useState<any>(null)
  const [selectedMethod, setSelectedMethod] = useState<LoginMethod>('nsec')
  const render = useForceRender()

  useEffect(() => {
    // Check if already logged in
    if (nostrAuth.isLoggedIn()) {
      loadUserProfile()
    }
  }, [])

  const loadUserProfile = async () => {
    try {
      const profile = await nostrAuth.getUserProfile()
      setUserProfile(profile)
    } catch (error) {
      console.error('Failed to load user profile:', error)
    }
  }

  const handleLogin = async () => {
    setIsLoading(true)
    setError('')

    try {
      let success = false

      switch (selectedMethod) {
        case 'nsec':
          if (!nsec.trim()) {
            setError('Please enter your nsec key')
            return
          }
          success = await nostrAuth.loginWithNsec(nsec.trim())
          break

        case 'nip07':
          if (!nostrAuth.isNip07Available()) {
            setError('NIP-07 browser extension not found. Please install a Nostr extension like Alby or nos2x.')
            return
          }
          success = await nostrAuth.loginWithNip07()
          break

        case 'nip46':
          if (!remotePubkey.trim()) {
            setError('Please enter the remote signer public key')
            return
          }
          success = await nostrAuth.loginWithNip46(remotePubkey.trim(), localNsec.trim() || undefined)
          break

        default:
          setError('Invalid login method')
          return
      }

      if (success) {
        setNsec('')
        setRemotePubkey('')
        setLocalNsec('')
        await loadUserProfile()
        onLogin?.()
        render()
      } else {
        setError(`Login failed. Please check your credentials and try again.`)
      }
    } catch (error) {
      setError(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await nostrAuth.logout()
      setUserProfile(null)
      onLogout?.()
      render()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin()
    }
  }

  if (nostrAuth.isLoggedIn() && userProfile) {
    const currentMethod = nostrAuth.getCurrentMethod()
    return (
      <div className="space-y-3">
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-3">
            {userProfile.picture && (
              <img
                src={userProfile.picture}
                alt="Profile"
                className="w-8 h-8 rounded-full"
              />
            )}
            <div>
              <p className="font-medium text-green-800">
                {userProfile.name || 'Anonymous'}
              </p>
              <p className="text-sm text-green-600">
                {userProfile.pubkey.slice(0, 16)}...
              </p>
              <p className="text-xs text-green-500">
                Connected via {currentMethod?.toUpperCase() || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={handleLogout}
          className="w-full"
        >
          Disconnect Nostr
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Login Method Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Login Method
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="loginMethod"
              value="nsec"
              checked={selectedMethod === 'nsec'}
              onChange={(e) => setSelectedMethod(e.target.value as LoginMethod)}
              className="mr-2"
            />
            <span className="text-sm">Private Key (nsec)</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="loginMethod"
              value="nip07"
              checked={selectedMethod === 'nip07'}
              onChange={(e) => setSelectedMethod(e.target.value as LoginMethod)}
              className="mr-2"
            />
            <span className="text-sm">
              Browser Extension (NIP-07)
              {nostrAuth.isNip07Available() ? (
                <span className="text-green-600 ml-1">✓ Available</span>
              ) : (
                <span className="text-red-600 ml-1">✗ Not Found</span>
              )}
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="loginMethod"
              value="nip46"
              checked={selectedMethod === 'nip46'}
              onChange={(e) => setSelectedMethod(e.target.value as LoginMethod)}
              className="mr-2"
            />
            <span className="text-sm">Remote Signer (NIP-46)</span>
          </label>
        </div>
      </div>

      {/* Input Fields Based on Selected Method */}
      {selectedMethod === 'nsec' && (
        <div>
          <label htmlFor="nsec" className="block text-sm font-medium text-gray-700 mb-1">
            Nostr Private Key (nsec)
          </label>
          <input
            id="nsec"
            type="password"
            value={nsec}
            onChange={(e) => setNsec(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="nsec1..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-gray-500">
            Your private key is stored locally and never sent to our servers
          </p>
        </div>
      )}

      {selectedMethod === 'nip07' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            {nostrAuth.isNip07Available()
              ? 'Click "Connect" to authenticate with your browser extension'
              : 'Please install a Nostr browser extension like Alby or nos2x to use this method'}
          </p>
        </div>
      )}

      {selectedMethod === 'nip46' && (
        <div className="space-y-3">
          <div>
            <label htmlFor="remotePubkey" className="block text-sm font-medium text-gray-700 mb-1">
              Remote Signer Public Key
            </label>
            <input
              id="remotePubkey"
              type="text"
              value={remotePubkey}
              onChange={(e) => setRemotePubkey(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="npub1..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>
          <div>
            <label htmlFor="localNsec" className="block text-sm font-medium text-gray-700 mb-1">
              Local Private Key (optional)
            </label>
            <input
              id="localNsec"
              type="password"
              value={localNsec}
              onChange={(e) => setLocalNsec(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="nsec1... (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Optional: Provide a local private key for enhanced security
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <Button
        onClick={handleLogin}
        disabled={isLoading || (selectedMethod === 'nsec' && !nsec.trim()) || (selectedMethod === 'nip46' && !remotePubkey.trim())}
        className="w-full"
      >
        {isLoading ? 'Connecting...' : `Connect with ${selectedMethod.toUpperCase()}`}
      </Button>
    </div>
  )
}
