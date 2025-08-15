import React, { useState, createContext, useEffect, useCallback } from 'react';
import { View, AllManagedWatchedData, Rating, ManagedWatchedItem } from './types';
import { allWatchedData as staticData } from './data/watchedData';
import { getFullMediaDetailsFromQuery } from './services/RecommendationService';
import MainMenu from './components/MainMenu';
import SuggestionView from './components/SuggestionView';
import StatsView from './components/StatsView';
import CollectionView from './components/CollectionView';
import RandomView from './components/RandomView';
import PredictView from './components/PredictView';

const initialData: AllManagedWatchedData = {
    amei: [], gostei: [], meh: [], naoGostei: []
};

// --- WatchedDataContext ---
interface IWatchedDataContext {
    data: AllManagedWatchedData;
    loading: boolean;
    addItem: (title: string, rating: Rating) => Promise<void>;
    removeItem: (id: number) => void;
    updateItem: (item: ManagedWatchedItem) => void;
}
export const WatchedDataContext = createContext<IWatchedDataContext>({
    data: initialData,
    loading: false,
    addItem: async () => {},
    removeItem: () => {},
    updateItem: () => {},
});

const ViewContainer = ({ children, onBack }: { children: React.ReactNode, onBack: () => void }) => (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 md:p-8 relative">
      <button 
        onClick={onBack}
        className="absolute top-4 left-4 bg-gray-800 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 z-10"
      >
        &larr; Voltar ao Menu
      </button>
      <div className="mt-12 sm:mt-16">
        {children}
      </div>
    </div>
);

const WatchedDataProvider = ({ children }: { children: React.ReactNode }) => {
    const [data, setData] = useState<AllManagedWatchedData>(initialData);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        try {
            const storedData = localStorage.getItem('watchedData');
            if (storedData) {
                const parsedData = JSON.parse(storedData) as AllManagedWatchedData;
                setData(parsedData);
            } else {
                // Seed from static files if no local data
                const now = Date.now();
                const seededData: AllManagedWatchedData = {
                    amei: staticData.amei.map((item, i) => ({ ...item, rating: 'amei', createdAt: now - i })),
                    gostei: staticData.gostei.map((item, i) => ({ ...item, rating: 'gostei', createdAt: now - (staticData.amei.length + i) })),
                    meh: staticData.meh.map((item, i) => ({ ...item, rating: 'meh', createdAt: now - (staticData.amei.length + staticData.gostei.length + i) })),
                    naoGostei: staticData.naoGostei.map((item, i) => ({ ...item, rating: 'naoGostei', createdAt: now - (staticData.amei.length + staticData.gostei.length + staticData.meh.length + i) })),
                };
                setData(seededData);
                localStorage.setItem('watchedData', JSON.stringify(seededData));
            }
        } catch (error) {
            console.error("Failed to load or parse data from localStorage", error);
        }
    }, []);
    
    const updateLocalStorage = (newData: AllManagedWatchedData) => {
        localStorage.setItem('watchedData', JSON.stringify(newData));
    };

    const addItem = useCallback(async (title: string, rating: Rating) => {
        setLoading(true);
        try {
            const mediaDetails = await getFullMediaDetailsFromQuery(title);

            const newItem: ManagedWatchedItem = {
                ...mediaDetails,
                rating,
                createdAt: Date.now(),
            };
            
            setData(currentData => {
                const newData = { ...currentData };
                 Object.keys(newData).forEach(key => {
                     const ratingKey = key as Rating;
                     newData[ratingKey] = newData[ratingKey].filter(item => item.id !== newItem.id);
                });
                newData[rating].push(newItem);
                newData[rating].sort((a, b) => b.createdAt - a.createdAt);
                updateLocalStorage(newData);
                return newData;
            });

        } catch(e) {
            console.error(e);
            throw new Error(e instanceof Error ? e.message : "Falha ao buscar informações do título.");
        } finally {
            setLoading(false);
        }
    }, []);
    
    const removeItem = useCallback((id: number) => {
       setData(currentData => {
           const newData = { ...currentData };
           Object.keys(newData).forEach(key => {
                const ratingKey = key as Rating;
                newData[ratingKey] = newData[ratingKey].filter(item => item.id !== id);
           });
           updateLocalStorage(newData);
           return newData;
       });
    }, []);

    const updateItem = useCallback((updatedItem: ManagedWatchedItem) => {
        setData(currentData => {
            const newData = { ...currentData };
            let found = false;
    
            for (const key of Object.keys(newData)) {
                const ratingKey = key as Rating;
                const itemIndex = newData[ratingKey].findIndex(item => item.id === updatedItem.id);
    
                if (itemIndex !== -1) {
                    if (ratingKey !== updatedItem.rating) {
                        const [itemToMove] = newData[ratingKey].splice(itemIndex, 1);
                        newData[updatedItem.rating].push({ ...itemToMove, ...updatedItem });
                        newData[updatedItem.rating].sort((a, b) => b.createdAt - a.createdAt);
                    } else {
                        newData[ratingKey][itemIndex] = updatedItem;
                    }
                    found = true;
                    break;
                }
            }
    
            if (found) {
                updateLocalStorage(newData);
                return newData;
            }
            return currentData;
        });
    }, []);


    return (
        <WatchedDataContext.Provider value={{ data, loading, addItem, removeItem, updateItem }}>
            {children}
        </WatchedDataContext.Provider>
    );
};


const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.MENU);

  const renderView = () => {
    const handleBackToMenu = () => setCurrentView(View.MENU);
    
    switch (currentView) {
      case View.MENU:
        return <MainMenu setView={setCurrentView} />;
      case View.SUGGESTION:
        return <ViewContainer onBack={handleBackToMenu}><SuggestionView /></ViewContainer>;
      case View.STATS:
        return <ViewContainer onBack={handleBackToMenu}><StatsView /></ViewContainer>;
      case View.COLLECTION:
        return <ViewContainer onBack={handleBackToMenu}><CollectionView /></ViewContainer>;
      case View.RANDOM:
        return <ViewContainer onBack={handleBackToMenu}><RandomView /></ViewContainer>;
      case View.PREDICT:
        return <ViewContainer onBack={handleBackToMenu}><PredictView /></ViewContainer>;
      default:
        return <MainMenu setView={setCurrentView} />;
    }
  };

  return (
    <WatchedDataProvider>
        <div className="App">
            {renderView()}
        </div>
    </WatchedDataProvider>
  );
};

export default App;
