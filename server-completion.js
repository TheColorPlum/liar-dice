io.to(roomCode).emit('gameReset', {
        players: room.players,
        currentPlayerIndex: room.currentPlayerIndex
      });

      rooms.set(roomCode, room);
      callback({ success: true });
      logRooms();
    } catch (error) {
      console.error('Error in resetGame:', error);
      callback({ success: false, error: error.message });
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
