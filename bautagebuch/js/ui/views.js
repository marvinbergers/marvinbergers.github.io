// Meldet alle Seiten beim Router an. Wird von main.js beim Start geladen.
import { registerView } from '../main.js';
import { GrundrissView } from './GrundrissView.js';

registerView('grundriss', GrundrissView);
import { Inbox } from './Inbox.js';
registerView('eingang', Inbox);
import { TagebuchView } from './Diary.js';
registerView('tagebuch', TagebuchView);
