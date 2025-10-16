import NDK from '@nostr-dev-kit/ndk'
import { NDKPrivateKeySigner, NDKNip07Signer, NDKNip46Signer } from '@nostr-dev-kit/ndk'
import { parseCookies, destroyCookie } from 'nookies'

// Initialize NDK with AI guardrails enabled
const ndk = new NDK({ 
  aiGuardrails: true,
  explicitRelayUrls: [
    'wss://relay.damus.io',
    'wss://relay.snort.social',
    'wss://nos.lol'
  ]
})

// Login method types
export type LoginMethod = 'nsec' | 'nip07' | 'nip46' | 'remote'

// Nostr authentication service
export class NostrAuth {
  private static instance: NostrAuth
  private ndk: NDK
  private isConnected = false
  private currentMethod: LoginMethod | null = null

  private constructor() {
    this.ndk = ndk
  }

  static getInstance(): NostrAuth {
    if (!NostrAuth.instance) {
      NostrAuth.instance = new NostrAuth()
    }
    return NostrAuth.instance
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.ndk.connect()
      this.isConnected = true
    }
  }

  // Check if NIP-07 is available
  isNip07Available(): boolean {
    return typeof window !== 'undefined' && !!window.nostr
  }

  // Login with NIP-07 browser extension
  async loginWithNip07(): Promise<boolean> {
    try {
      if (!this.isNip07Available()) {
        throw new Error('NIP-07 browser extension not found')
      }

      await this.connect()
      
      // Create NIP-07 signer
      const signer = new NDKNip07Signer()
      this.ndk.signer = signer
      
      // Get user profile
      const user = await this.ndk.signer?.user()
      if (!user) {
        throw new Error('Failed to get user from NIP-07')
      }

      // Store login method and pubkey
      if (typeof window !== 'undefined') {
        localStorage.setItem('nostr_method', 'nip07')
        localStorage.setItem('nostr_pubkey', user.pubkey)
      }

      this.currentMethod = 'nip07'
      return true
    } catch (error) {
      console.error('NIP-07 login failed:', error)
      return false
    }
  }

  // Login with NIP-46 remote signer
  async loginWithNip46(remotePubkey: string, localNsec?: string): Promise<boolean> {
    try {
      await this.connect()
      
      // Create local signer if nsec provided
      const localSigner = localNsec ? new NDKPrivateKeySigner(localNsec) : undefined
      
      // Create NIP-46 signer
      const signer = new NDKNip46Signer(this.ndk, remotePubkey, localSigner)
      this.ndk.signer = signer
      
      // Get user profile
      const user = await this.ndk.signer?.user()
      if (!user) {
        throw new Error('Failed to get user from NIP-46')
      }

      // Store login method and pubkey
      if (typeof window !== 'undefined') {
        localStorage.setItem('nostr_method', 'nip46')
        localStorage.setItem('nostr_pubkey', user.pubkey)
        if (localNsec) {
          localStorage.setItem('nostr_nsec', localNsec)
        }
      }

      this.currentMethod = 'nip46'
      return true
    } catch (error) {
      console.error('NIP-46 login failed:', error)
      return false
    }
  }

  // Login with nsec (private key)
  async loginWithNsec(nsec: string): Promise<boolean> {
    try {
      await this.connect()
      
      // Create signer from nsec
      const signer = new NDKPrivateKeySigner(nsec)
      this.ndk.signer = signer
      
      // Get user profile
      const user = await this.ndk.signer?.user()
      if (!user) {
        throw new Error('Failed to get user from nsec')
      }

      // Store nsec securely in localStorage (in production, consider more secure storage)
      if (typeof window !== 'undefined') {
        localStorage.setItem('nostr_method', 'nsec')
        localStorage.setItem('nostr_nsec', nsec)
        localStorage.setItem('nostr_pubkey', user.pubkey)
      }

      this.currentMethod = 'nsec'
      return true
    } catch (error) {
      console.error('Nostr login failed:', error)
      return false
    }
  }

  async logout(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('nostr_nsec')
        localStorage.removeItem('nostr_pubkey')
        localStorage.removeItem('nostr_method')
      }
      this.ndk.signer = undefined
      this.currentMethod = null
    } catch (error) {
      console.error('Nostr logout failed:', error)
    }
  }

  isLoggedIn(): boolean {
    if (typeof window === 'undefined') return false
    return !!(localStorage.getItem('nostr_pubkey') && localStorage.getItem('nostr_method'))
  }

  getCurrentMethod(): LoginMethod | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('nostr_method') as LoginMethod || null
  }

  getPubkey(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('nostr_pubkey')
  }

  async getUserProfile(): Promise<any> {
    try {
      if (!this.isLoggedIn()) return null
      
      await this.connect()
      const user = await this.ndk.signer?.user()
      if (!user) return null

      return {
        pubkey: user.pubkey,
        name: user.profile?.name,
        about: user.profile?.about,
        picture: user.profile?.image
      }
    } catch (error) {
      console.error('Failed to get user profile:', error)
      return null
    }
  }

  async publishEvent(kind: number, content: string, tags: string[][] = []): Promise<string | null> {
    try {
      if (!this.isLoggedIn()) return null
      
      await this.connect()
      
      // For now, just log the event - full publishing can be implemented later
      console.log('Publishing nostr event:', { kind, content, tags })
      
      // Return a mock event ID for now
      return `nostr_event_${Date.now()}`
    } catch (error) {
      console.error('Failed to publish event:', error)
      return null
    }
  }
}

// Export singleton instance
export const nostrAuth = NostrAuth.getInstance()
