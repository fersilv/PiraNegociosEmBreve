import { Injectable, OnModuleInit } from '@nestjs/common';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const credentialPath = this.configService.get<string>('FIREBASE_CREDENTIALS');
    
    try {
      if (getApps().length === 0) {
        if (credentialPath) {
          initializeApp({
            credential: cert(JSON.parse(readFileSync(credentialPath, 'utf8'))),
          });
          console.log('Firebase Admin initialized with credentials file.');
        } else {
          initializeApp();
          console.log('Firebase Admin initialized with default credentials.');
        }
      }
    } catch (error) {
      console.error('Error initializing Firebase Admin:', error);
    }
  }

  getAuth(): Auth {
    return getAuth();
  }

  getMessaging(): Messaging {
    return getMessaging();
  }
}
